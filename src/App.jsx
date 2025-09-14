
import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Check, PlusCircle, PackageSearch, Truck, QrCode, Files, Download } from "lucide-react";

/**
 * JASTIP LITE (FREE) — React + Supabase
 * ENV: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Tarif (edit sesuai kebutuhan)
const RATE = {
  baseFee: 5000,
  jasaJastip: 3000,
  perKg: 12000,
  volumetricDivisor: 6000,
};

const CUT_OFF_DAY = "Selasa";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function currency(n) {
  try {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);
  } catch {
    return `Rp${n}`;
  }
}

function volumetricWeight(l, w, h, divisor = 6000) {
  if (!l || !w || !h) return 0;
  return (l * w * h) / divisor;
}

function computeFee({ weight, l, w, h }) {
  const vol = volumetricWeight(l, w, h, RATE.volumetricDivisor);
  const billable = Math.max(Number(weight || 0), vol);
  const total = RATE.baseFee + RATE.jasaJastip + Math.ceil(billable) * RATE.perKg;
  return { vol, billable, total };
}

function randomCode(prefix = "FLR", len = 4) {
  const n = Math.random().toString(36).slice(2, 2 + len).toUpperCase();
  return `${prefix}${n}`;
}

async function uploadProof(file, folder = "inbound") {
  if (!file) return null;
  const filename = `${folder}/${Date.now()}-${file.name}`;
  const { data, error } = await supabase.storage.from("proof").upload(filename, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data: pub } = supabase.storage.from("proof").getPublicUrl(data.path);
  return pub?.publicUrl || null;
}

function Section({ title, icon, children, right }) {
  const Icon = icon || PackageSearch;
  return (
    <div className="rounded-2xl p-5 bg-white shadow-sm border mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5" />
          <h2 className="text-xl font-semibold">{title}</h2>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("customers");
  const [customers, setCustomers] = useState([]);
  const [newCust, setNewCust] = useState({ name: "", wa: "", address: "", code: "" });
  const [parcels, setParcels] = useState([]);
  const [preAlert, setPreAlert] = useState({ customer_id: "", resi: "", marketplace: "Shopee", declared_value: "" });
  const [rx, setRx] = useState({ resi: "", weight: "", l: "", w: "", h: "", rack: "", photo_in: null, repack: false });
  const [busy, setBusy] = useState(false);
  const [batches, setBatches] = useState([]);
  const [newBatch, setNewBatch] = useState({ code: "", etd: "", eta: "" });

  useEffect(() => { (async () => { await loadAll(); })(); }, []);

  async function loadAll() {
    const { data: c } = await supabase.from("customers").select("*").order("created_at", { ascending: false });
    setCustomers(c || []);
    const { data: p } = await supabase.from("parcels").select("*").order("created_at", { ascending: false });
    setParcels(p || []);
    const { data: b } = await supabase.from("batches").select("*").order("etd", { ascending: false });
    setBatches(b || []);
  }

  async function addCustomer() {
    setBusy(true);
    try {
      const code = newCust.code?.trim() || randomCode();
      const payload = { ...newCust, code };
      const { error } = await supabase.from("customers").insert(payload);
      if (error) throw error;
      setNewCust({ name: "", wa: "", address: "", code: "" });
      await loadAll();
      alert(`Customer dibuat. Kode Unik: ${code}`);
    } catch (e) { alert(`Gagal tambah customer: ${e.message}`); } finally { setBusy(false); }
  }

  async function addPreAlert() {
    setBusy(true);
    try {
      if (!preAlert.customer_id || !preAlert.resi) throw new Error("Pilih customer dan isi nomor resi");
      const payload = { ...preAlert, status: "EXPECTED" };
      const { error } = await supabase.from("parcels").insert(payload);
      if (error) throw error;
      setPreAlert({ customer_id: "", resi: "", marketplace: "Shopee", declared_value: "" });
      await loadAll();
    } catch (e) { alert(`Gagal pre-alert: ${e.message}`); } finally { setBusy(false); }
  }

  async function receiveParcel() {
    setBusy(true);
    try {
      if (!rx.resi) throw new Error("Masukkan nomor resi yang akan di-scan/terima");
      const { data: found, error: qErr } = await supabase.from("parcels").select("*").eq("resi", rx.resi).limit(1).maybeSingle();
      if (qErr) throw qErr;
      if (!found) throw new Error("Resi belum ada di sistem. Buat PRE-ALERT dulu atau terima sebagai UNKNOWN.");

      const photoUrl = rx.photo_in ? await uploadProof(rx.photo_in, "inbound") : null;
      const fee = computeFee({ weight: Number(rx.weight), l: Number(rx.l), w: Number(rx.w), h: Number(rx.h) });

      const upd = {
        status: "RECEIVED",
        weight: Number(rx.weight) || null,
        l: Number(rx.l) || null, w: Number(rx.w) || null, h: Number(rx.h) || null,
        rack: rx.rack || null,
        photo_in_url: photoUrl,
        fee: fee.total, billable_weight: fee.billable,
      };
      const { error } = await supabase.from("parcels").update(upd).eq("id", found.id);
      if (error) throw error;
      setRx({ resi: "", weight: "", l: "", w: "", h: "", rack: "", photo_in: null, repack: false });
      await loadAll();
      alert("Paket diterima & dihitung. Tagihan siap dikirim ke pelanggan.");
    } catch (e) { alert(`Gagal receive: ${e.message}`); } finally { setBusy(false); }
  }

  async function markPaid(parcelId) {
    setBusy(true);
    try {
      const { error } = await supabase.from("parcels").update({ status: "PAID", paid_at: new Date().toISOString() }).eq("id", parcelId);
      if (error) throw error;
      await loadAll();
    } catch (e) { alert(`Gagal set LUNAS: ${e.message}`); } finally { setBusy(false); }
  }

  async function createBatch() {
    setBusy(true);
    try {
      if (!newBatch.code) throw new Error("Isi kode batch (mis. DLU-2025-09-17-B1)");
      const { error } = await supabase.from("batches").insert({ ...newBatch, status: "OPEN" });
      if (error) throw error;
      setNewBatch({ code: "", etd: "", eta: "" });
      await loadAll();
    } catch (e) { alert(`Gagal buat batch: ${e.message}`); } finally { setBusy(false); }
  }

  async function addToBatch(parcelId, batchCode) {
    setBusy(true);
    try {
      const seal = prompt("Nomor segel BAG (opsional, isi jika sudah bagging):", "");
      const bagId = prompt("ID BAG/karung (opsional):", "BAG-001");
      const upd = { status: seal ? "BAGGED" : "READY_TO_SHIP", batch_code: batchCode, bag_id: bagId || null, seal_number: seal || null };
      const { error } = await supabase.from("parcels").update(upd).eq("id", parcelId);
      if (error) throw error;
      await loadAll();
    } catch (e) { alert(`Gagal tambah ke batch: ${e.message}`); } finally { setBusy(false); }
  }

  async function setBatchStatus(code, status) {
    setBusy(true);
    try {
      const { error } = await supabase.from("batches").update({ status }).eq("code", code);
      if (error) throw error;
      await loadAll();
    } catch (e) { alert(`Gagal ubah status batch: ${e.message}`); } finally { setBusy(false); }
  }

  function waMessageOnArrive(parcel) {
    return (
      `Halo ${parcel.customer_name || "Pelanggan"}, paket ${parcel.resi} ` +
      `sudah TIBA di gudang Surabaya. Estimasi biaya ${currency(parcel.fee)}.\n` +
      `Status pembayaran: ${parcel.status === "PAID" ? "LUNAS" : "MENUNGGU"}. ` +
      `Cut-off: ${CUT_OFF_DAY}. Terima kasih!`
    );
  }

  function downloadManifestCSV(batchCode) {
    const rows = parcels.filter((p) => p.batch_code === batchCode);
    const headers = ["resi","customer_code","customer_name","marketplace","weight","billable_weight","rack","bag_id","seal_number","fee"];
    const lines = [headers.join(",")];
    rows.forEach((r) => {
      lines.push([r.resi,r.customer_code||"",r.customer_name||"",r.marketplace||"",r.weight||"",r.billable_weight||"",r.rack||"",r.bag_id||"",r.seal_number||"",r.fee||""].join(","));
    });
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${batchCode}-manifest.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const waiting = busy ? "opacity-60 pointer-events-none" : "";
  const parcelsEnriched = useMemo(() => {
    const custMap = Object.fromEntries(customers.map((c) => [c.id, c]));
    return parcels.map((p) => ({ ...p, customer_name: custMap[p.customer_id]?.name, customer_code: custMap[p.customer_id]?.code, customer_wa: custMap[p.customer_id]?.wa }));
  }, [parcels, customers]);

  return (
    <div className="min-h-screen" style={{background:"#f1f5f9", padding:"20px"}}>
      <div className="max-w-6xl" style={{margin:"0 auto"}}>
        <header className="flex items-center justify-between mb-6" style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"24px"}}>
          <h1 className="text-2xl font-bold">Jastip Lite (Free)</h1>
          <nav className="flex gap-2">
            {[["customers","Pelanggan"],["prealert","Pre-Alert"],["receive","Inbound"],["billing","Tagihan"],["batches","Batch Kapal"]].map(([k,label]) => (
              <button key={k} onClick={() => setTab(k)} style={{padding:"8px 12px",borderRadius:"12px",border:"1px solid #e2e8f0",background:"#fff",fontSize:"14px"}}>
                {label}
              </button>
            ))}
          </nav>
        </header>

        {tab === "customers" && (
          <Section title="Pelanggan" icon={PlusCircle} right={<span style={{fontSize:12,color:"#64748b"}}>Buat Kode Unik otomatis</span>}>
            <div className={waiting} style={{display:"grid",gap:"12px",gridTemplateColumns:"repeat(3,minmax(0,1fr))"}}>
              <input className="border rounded-xl p-3" placeholder="Nama" value={newCust.name} onChange={(e) => setNewCust({ ...newCust, name: e.target.value })} />
              <input className="border rounded-xl p-3" placeholder="No. WhatsApp" value={newCust.wa} onChange={(e) => setNewCust({ ...newCust, wa: e.target.value })} />
              <input className="border rounded-xl p-3" placeholder="Alamat Flores (opsional)" value={newCust.address} onChange={(e) => setNewCust({ ...newCust, address: e.target.value })} />
              <input className="border rounded-xl p-3" placeholder="Kode Unik (biarkan kosong untuk auto)" value={newCust.code} onChange={(e) => setNewCust({ ...newCust, code: e.target.value })} />
              <button onClick={addCustomer} className="rounded-xl" style={{background:"#000",color:"#fff",padding:"12px 16px",borderRadius:"12px",display:"flex",gap:"8px",alignItems:"center"}}><Check className="w-4 h-4"/> Simpan</button>
            </div>

            <div className="mt-6" style={{overflowX:"auto"}}>
              <table className="w-full text-sm">
                <thead><tr className="text-left border-b"><th className="py-2">Nama</th><th>Kode</th><th>WA</th><th>Alamat</th></tr></thead>
                <tbody>{customers.map((c)=>(<tr key={c.id} className="border-b"><td className="py-2">{c.name}</td><td>{c.code}</td><td>{c.wa}</td><td>{c.address}</td></tr>))}</tbody>
              </table>
            </div>
          </Section>
        )}

        {tab === "prealert" && (
          <Section title="Pre-Alert Paket" icon={Files}>
            <div className={waiting} style={{display:"grid",gap:"12px",gridTemplateColumns:"repeat(5,minmax(0,1fr))"}}>
              <select className="border rounded-xl p-3" value={preAlert.customer_id} onChange={(e) => setPreAlert({ ...preAlert, customer_id: e.target.value })}>
                <option value="">Pilih Customer</option>
                {customers.map((c) => (<option key={c.id} value={c.id}>{c.name} [{c.code}]</option>))}
              </select>
              <input className="border rounded-xl p-3" placeholder="No. Resi" value={preAlert.resi} onChange={(e) => setPreAlert({ ...preAlert, resi: e.target.value })} />
              <select className="border rounded-xl p-3" value={preAlert.marketplace} onChange={(e) => setPreAlert({ ...preAlert, marketplace: e.target.value })}>
                <option>Shopee</option><option>Tokopedia</option><option>Lazada</option><option>Tiktok Shop</option><option>Lainnya</option>
              </select>
              <input className="border rounded-xl p-3" placeholder="Nilai Barang (Rp)" value={preAlert.declared_value} onChange={(e) => setPreAlert({ ...preAlert, declared_value: e.target.value })} />
              <button onClick={addPreAlert} className="rounded-xl" style={{background:"#000",color:"#fff",padding:"12px 16px",borderRadius:"12px",display:"flex",gap:"8px",alignItems:"center"}}><PlusCircle className="w-4 h-4"/> Tambah</button>
            </div>

            <div className="mt-6" style={{overflowX:"auto"}}>
              <table className="w-full text-sm">
                <thead><tr className="text-left border-b"><th className="py-2">Resi</th><th>Pelanggan</th><th>Marketplace</th><th>Status</th></tr></thead>
                <tbody>{parcelsEnriched.filter(p=>p.status==="EXPECTED").map((p)=>(<tr key={p.id} className="border-b"><td className="py-2">{p.resi}</td><td>{p.customer_name} [{p.customer_code}]</td><td>{p.marketplace}</td><td>{p.status}</td></tr>))}</tbody>
              </table>
            </div>
          </Section>
        )}

        {tab === "receive" && (
          <Section title="Inbound / Terima Paket" icon={PackageSearch}>
            <div className={waiting} style={{display:"grid",gap:"12px",gridTemplateColumns:"repeat(6,minmax(0,1fr))"}}>
              <input className="border rounded-xl p-3" placeholder="Scan/ketik No. Resi" value={rx.resi} onChange={(e) => setRx({ ...rx, resi: e.target.value })} />
              <input className="border rounded-xl p-3" placeholder="Berat (kg)" value={rx.weight} onChange={(e) => setRx({ ...rx, weight: e.target.value })} />
              <input className="border rounded-xl p-3" placeholder="P (cm)" value={rx.l} onChange={(e) => setRx({ ...rx, l: e.target.value })} />
              <input className="border rounded-xl p-3" placeholder="L (cm)" value={rx.w} onChange={(e) => setRx({ ...rx, w: e.target.value })} />
              <input className="border rounded-xl p-3" placeholder="T (cm)" value={rx.h} onChange={(e) => setRx({ ...rx, h: e.target.value })} />
              <input className="border rounded-xl p-3" placeholder="Rak/Slot" value={rx.rack} onChange={(e) => setRx({ ...rx, rack: e.target.value })} />
              <input className="border rounded-xl p-3" type="file" onChange={(e) => setRx({ ...rx, photo_in: e.target.files?.[0] || null })} style={{gridColumn:"span 3 / span 3"}} />
              <button onClick={receiveParcel} className="rounded-xl" style={{background:"#000",color:"#fff",padding:"12px 16px",borderRadius:"12px",display:"flex",gap:"8px",alignItems:"center",gridColumn:"span 2 / span 2"}}><Check className="w-4 h-4"/> Terima & Hitung</button>
            </div>

            <div className="mt-6" style={{overflowX:"auto"}}>
              <table className="w-full text-sm">
                <thead><tr className="text-left border-b"><th className="py-2">Resi</th><th>Pelanggan</th><th>Rak</th><th>Berat</th><th>Dimensi</th><th>Tagihan</th><th>Aksi</th></tr></thead>
                <tbody>{parcelsEnriched.filter(p=>["RECEIVED","PAID","READY_TO_SHIP","BAGGED"].includes(p.status)).map((p)=>(
                  <tr key={p.id} className="border-b">
                    <td className="py-2">{p.resi}</td>
                    <td>{p.customer_name} [{p.customer_code}]</td>
                    <td>{p.rack}</td>
                    <td>{p.weight} kg</td>
                    <td>{p.l}×{p.w}×{p.h}</td>
                    <td>{currency(p.fee)}</td>
                    <td className="flex gap-2 py-2">
                      {p.status !== "PAID" && (<button onClick={()=>markPaid(p.id)} style={{padding:"4px 8px",fontSize:12,border:"1px solid #e2e8f0",borderRadius:"8px"}}>Tandai Lunas</button>)}
                      <button onClick={()=>{navigator.clipboard.writeText(waMessageOnArrive(p));alert("Pesan disalin. Paste di WhatsApp pelanggan.");}} style={{padding:"4px 8px",fontSize:12,border:"1px solid #e2e8f0",borderRadius:"8px"}}>Salin Pesan WA</button>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </Section>
        )}

        {tab === "billing" && (
          <Section title="Tagihan & Siap Batch" icon={QrCode}>
            <div style={{overflowX:"auto"}}>
              <table className="w-full text-sm">
                <thead><tr className="text-left border-b"><th className="py-2">Resi</th><th>Pelanggan</th><th>Status</th><th>Fee</th><th>Batch</th><th>Aksi</th></tr></thead>
                <tbody>{parcelsEnriched.filter(p=>["RECEIVED","PAID","READY_TO_SHIP","BAGGED"].includes(p.status)).map((p)=>(
                  <tr key={p.id} className="border-b">
                    <td className="py-2">{p.resi}</td>
                    <td>{p.customer_name} [{p.customer_code}]</td>
                    <td>{p.status}</td>
                    <td>{currency(p.fee)}</td>
                    <td>{p.batch_code || "-"}</td>
                    <td className="flex gap-2 py-2">
                      {p.status === "RECEIVED" && (<button onClick={()=>markPaid(p.id)} style={{padding:"4px 8px",fontSize:12,border:"1px solid #e2e8f0",borderRadius:"8px"}}>Tandai Lunas</button>)}
                      <select onChange={(e)=>e.target.value && addToBatch(p.id, e.target.value)} defaultValue="" style={{padding:"4px 8px",fontSize:12,border:"1px solid #e2e8f0",borderRadius:"8px"}}>
                        <option value="" disabled>Tambah ke Batch…</option>
                        {batches.map((b)=>(<option key={b.code} value={b.code}>{b.code}</option>))}
                      </select>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </Section>
        )}

        {tab === "batches" && (
          <Section title="Batch Kapal DLU" icon={Truck}>
            <div className={waiting} style={{display:"grid",gap:"12px",gridTemplateColumns:"repeat(4,minmax(0,1fr))"}}>
              <input className="border rounded-xl p-3" placeholder="Kode Batch (DLU-YYYY-MM-DD-B1)" value={newBatch.code} onChange={(e) => setNewBatch({ ...newBatch, code: e.target.value })} />
              <input className="border rounded-xl p-3" type="date" placeholder="ETD" value={newBatch.etd} onChange={(e) => setNewBatch({ ...newBatch, etd: e.target.value })} />
              <input className="border rounded-xl p-3" type="date" placeholder="ETA" value={newBatch.eta} onChange={(e) => setNewBatch({ ...newBatch, eta: e.target.value })} />
              <button onClick={createBatch} className="rounded-xl" style={{background:"#000",color:"#fff",padding:"12px 16px",borderRadius:"12px",display:"flex",gap:"8px",alignItems:"center"}}><PlusCircle className="w-4 h-4"/> Buat Batch</button>
            </div>

            <div className="mt-6" style={{display:"grid",gap:"16px",gridTemplateColumns:"repeat(2,minmax(0,1fr))"}}>
              {batches.map((b) => (
                <div key={b.code} className="border rounded-2xl p-4 bg-white">
                  <div className="flex items-center justify-between" style={{display:"flex",justifyContent:"space-between"}}>
                    <div>
                      <div className="font-semibold">{b.code}</div>
                      <div className="text-xs" style={{color:"#64748b"}}>ETD: {b.etd?.slice(0,10)} • ETA: {b.eta?.slice(0,10)} • Status: {b.status}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setBatchStatus(b.code, "ON_TRUCK") } className="text-xs" style={{border:"1px solid #e2e8f0",borderRadius:"8px",padding:"4px 8px"}}>On Truck</button>
                      <button onClick={() => setBatchStatus(b.code, "ON_VESSEL") } className="text-xs" style={{border:"1px solid #e2e8f0",borderRadius:"8px",padding:"4px 8px"}}>On Vessel</button>
                      <button onClick={() => setBatchStatus(b.code, "ARRIVED") } className="text-xs" style={{border:"1px solid #e2e8f0",borderRadius:"8px",padding:"4px 8px"}}>Arrived</button>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="text-xs font-semibold mb-1">Paket dalam batch ini</div>
                    <div style={{overflowX:"auto"}}>
                      <table className="w-full text-xs">
                        <thead><tr className="text-left border-b"><th className="py-2">Resi</th><th>Pelanggan</th><th>Bag</th><th>Segel</th><th>Berat</th></tr></thead>
                        <tbody>
                          {parcelsEnriched.filter(p => p.batch_code === b.code).map((p) => (
                            <tr key={p.id} className="border-b">
                              <td className="py-2">{p.resi}</td>
                              <td>{p.customer_name} [{p.customer_code}]</td>
                              <td>{p.bag_id || '-'}</td>
                              <td>{p.seal_number || '-'}</td>
                              <td>{p.weight || '-'} kg</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-3" style={{display:"flex",gap:"8px"}}>
                      <button onClick={() => downloadManifestCSV(b.code)} style={{border:"1px solid #e2e8f0",borderRadius:"8px",padding:"6px 10px",fontSize:12,display:"flex",gap:"8px",alignItems:"center"}}><Download className="w-4 h-4"/> Unduh Manifest CSV</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        <footer className="text-xs" style={{color:"#64748b",marginTop:"40px"}}>
          © {new Date().getFullYear()} Jastip Lite (Free). Fitur inti: Pre-alert → Terima & hitung → Tagih → Batch DLU → Manifest.
        </footer>
      </div>
    </div>
  );
}
