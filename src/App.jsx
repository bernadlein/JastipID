import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Check, PlusCircle, Download, Globe } from "lucide-react";

// === Supabase ===
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === Constants ===
const RATE = { baseFee: 5000, jasaJastip: 3000, perKg: 12000, volumetricDivisor: 6000 };
const CUT_OFF_DAY = "Selasa";
const REGIONS = ["LEMBATA", "WAIWERANG", "WITIHAMA", "LARANTUKA"];
const regionLabel = (r) =>
  ({ LEMBATA: "Lembata", WAIWERANG: "Waiwerang", WITIHAMA: "Witihama", LARANTUKA: "Larantuka" }[r] || "—");

// === i18n minimal ===
const tdict = {
  id: {
    app: "Jastip Lite (Free)",
    customers: "Pelanggan",
    prealert: "Pre-Alert",
    receive: "Inbound",
    billing: "Tagihan",
    batches: "Batch Kapal",
    create: "Simpan",
    name: "Nama",
    wa: "No. WhatsApp",
    address: "Alamat Flores (opsional)",
    uniq: "Kode Unik (auto kosongkan)",
    chooseCustomer: "Pilih Customer",
    trackingNo: "No. Resi",
    marketplace: "Marketplace",
    value: "Nilai Barang (Rp)",
    add: "Tambah",
    scan: "Scan/ketik No. Resi",
    weight: "Berat (kg)",
    L: "P (cm)",
    W: "L (cm)",
    H: "T (cm)",
    rack: "Rak/Slot",
    photo: "Foto (kamera)",
    region: "Wilayah",
    all: "Semua",
    search: "Cari nama/kode…",
    receiveCalc: "Terima & Hitung",
    markPaid: "Tandai Lunas",
    copyWA: "Salin Pesan WA",
    addToBatch: "Tambah ke Batch…",
    code: "Kode Batch (DLU-YYYY-MM-DD-B1)",
    etd: "ETD",
    eta: "ETA",
    makeBatch: "Buat Batch",
    onTruck: "On Truck",
    onVessel: "On Vessel",
    arrived: "Arrived",
    table: {
      resi: "Resi",
      customer: "Pelanggan",
      rack: "Rak",
      weight: "Berat",
      dims: "Dimensi",
      fee: "Tagihan",
      action: "Aksi",
      status: "Status",
      batch: "Batch",
      bag: "Bag",
      seal: "Segel",
    },
    footer: "Fitur inti: Pre-alert → Terima & hitung → Tagih → Batch DLU → Manifest.",
  },
  en: {
    app: "Jastip Lite (Free)",
    customers: "Customers",
    prealert: "Pre-Alert",
    receive: "Inbound",
    billing: "Billing",
    batches: "DLU Batches",
    create: "Create",
    name: "Full Name",
    wa: "WhatsApp",
    address: "Flores Address (optional)",
    uniq: "Unique Code (leave blank to auto)",
    chooseCustomer: "Select Customer",
    trackingNo: "Tracking No",
    marketplace: "Marketplace",
    value: "Declared Value",
    add: "Add",
    scan: "Scan/type Tracking No",
    weight: "Weight (kg)",
    L: "L (cm)",
    W: "W (cm)",
    H: "H (cm)",
    rack: "Rack/Slot",
    photo: "Photo (camera)",
    region: "Region",
    all: "All",
    search: "Search name/code…",
    receiveCalc: "Receive & Calculate",
    markPaid: "Mark Paid",
    copyWA: "Copy WhatsApp Msg",
    addToBatch: "Add to Batch…",
    code: "Batch Code (DLU-YYYY-MM-DD-B1)",
    etd: "ETD",
    eta: "ETA",
    makeBatch: "Create Batch",
    onTruck: "On Truck",
    onVessel: "On Vessel",
    arrived: "Arrived",
    table: {
      resi: "Tracking",
      customer: "Customer",
      rack: "Rack",
      weight: "Weight",
      dims: "Dimensions",
      fee: "Fee",
      action: "Action",
      status: "Status",
      batch: "Batch",
      bag: "Bag",
      seal: "Seal",
    },
    footer: "Core flow: Pre-alert → Receive & rate → Billing → DLU Batch → Manifest.",
  },
};
function useI18n() {
  const [lang, setLang] = useState(localStorage.getItem("lang") || "id");
  const t = (k) => k.split(".").reduce((a, c) => a?.[c], tdict[lang]);
  const swap = (l) => {
    setLang(l);
    localStorage.setItem("lang", l);
  };
  return { t, lang, swap };
}

// === helpers ===
function currency(n, lang = "id") {
  try {
    return new Intl.NumberFormat(lang === "en" ? "en-US" : "id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(n || 0);
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
  const { data, error } = await supabase.storage
    .from("proof")
    .upload(filename, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  const { data: pub } = supabase.storage.from("proof").getPublicUrl(data.path);
  return pub?.publicUrl || null;
}

function Section({ title, children, right, id }) {
  return (
    <div id={id} className="card">
      <div className="flex" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2>{title}</h2>
        <div>{right}</div>
      </div>
      {children}
    </div>
  );
}

// === App ===
export default function App() {
  const { t, lang, swap } = useI18n();
  const [tab, setTab] = useState("customers");
  const [busy, setBusy] = useState(false);

  const [customers, setCustomers] = useState([]);
  const [newCust, setNewCust] = useState({ name: "", wa: "", address: "", code: "", region: "" });
  const [searchQ, setSearchQ] = useState("");
  const [regionFilter, setRegionFilter] = useState("ALL");

  const [parcels, setParcels] = useState([]);
  const [preAlert, setPreAlert] = useState({ customer_id: "", resi: "", marketplace: "Shopee", declared_value: "" });

  const [rx, setRx] = useState({ resi: "", weight: "", l: "", w: "", h: "", rack: "", photo_in: null });

  const [batches, setBatches] = useState([]);
  const [newBatch, setNewBatch] = useState({ code: "", etd: "", eta: "" });

  useEffect(() => {
    (async () => {
      await loadAll();
    })();
  }, []);

  async function loadAll() {
    const { data: c } = await supabase.from("customers").select("*").order("created_at", { ascending: false });
    setCustomers(c || []);
    const { data: p } = await supabase.from("parcels").select("*").order("created_at", { ascending: false });
    setParcels(p || []);
    const { data: b } = await supabase.from("batches").select("*").order("etd", { ascending: false });
    setBatches(b || []);
  }

  // === Customers ===
  async function addCustomer() {
    setBusy(true);
    try {
      const code = newCust.code?.trim() || randomCode();
      const region = (newCust.region || "").toUpperCase() || null;
      if (region && !REGIONS.includes(region)) throw new Error("Wilayah tidak valid");
      const payload = { ...newCust, code, region };
      const { error } = await supabase.from("customers").insert(payload);
      if (error) throw error;
      setNewCust({ name: "", wa: "", address: "", code: "", region: "" });
      await loadAll();
      alert(`Customer created. Code: ${code}`);
    } catch (e) {
      alert(`Failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }
  async function setRegion(id, region) {
    setBusy(true);
    try {
      const val = region?.toUpperCase() || null;
      const { error } = await supabase.from("customers").update({ region: val }).eq("id", id);
      if (error) throw error;
      await loadAll();
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }

  const regionCounts = useMemo(() => {
    const m = { ALL: customers.length };
    REGIONS.forEach((r) => (m[r] = customers.filter((c) => c.region === r).length));
    return m;
  }, [customers]);

  const visibleCustomers = useMemo(() => {
    let list = regionFilter === "ALL" ? customers : customers.filter((c) => c.region === regionFilter);
    if (searchQ?.trim()) {
      const q = searchQ.trim().toLowerCase();
      list = list.filter((c) => (c.name || "").toLowerCase().includes(q) || (c.code || "").toLowerCase().includes(q));
    }
    return list;
  }, [customers, regionFilter, searchQ]);

  // === Pre-Alert ===
  async function addPreAlert() {
    setBusy(true);
    try {
      if (!preAlert.customer_id || !preAlert.resi) throw new Error("Select customer & tracking no");
      const payload = { ...preAlert, status: "EXPECTED" };
      const { error } = await supabase.from("parcels").insert(payload);
      if (error) throw error;
      setPreAlert({ customer_id: "", resi: "", marketplace: "Shopee", declared_value: "" });
      await loadAll();
    } catch (e) {
      alert(`Pre-alert failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  // === Receive ===
  async function receiveParcel() {
    setBusy(true);
    try {
      if (!rx.resi) throw new Error("Provide tracking number");
      const { data: found, error: qErr } = await supabase
        .from("parcels")
        .select("*")
        .eq("resi", rx.resi)
        .limit(1)
        .maybeSingle();
      if (qErr) throw qErr;
      if (!found) throw new Error("Resi belum ada di sistem. Buat PRE-ALERT dulu.");

      const photoUrl = rx.photo_in ? await uploadProof(rx.photo_in, "inbound") : null;
      const fee = computeFee({ weight: Number(rx.weight), l: Number(rx.l), w: Number(rx.w), h: Number(rx.h) });

      const upd = {
        status: "RECEIVED",
        weight: Number(rx.weight) || null,
        l: Number(rx.l) || null,
        w: Number(rx.w) || null,
        h: Number(rx.h) || null,
        rack: rx.rack || null,
        photo_in_url: photoUrl,
        fee: fee.total,
        billable_weight: fee.billable,
      };
      const { error } = await supabase.from("parcels").update(upd).eq("id", found.id);
      if (error) throw error;
      setRx({ resi: "", weight: "", l: "", w: "", h: "", rack: "", photo_in: null });
      await loadAll();
      alert("Paket diterima & dihitung.");
    } catch (e) {
      alert(`Gagal receive: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function markPaid(parcelId) {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("parcels")
        .update({ status: "PAID", paid_at: new Date().toISOString() })
        .eq("id", parcelId);
      if (error) throw error;
      await loadAll();
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }

  // === Batches ===
  async function createBatch() {
    setBusy(true);
    try {
      if (!newBatch.code) throw new Error("Isi kode batch");
      const { error } = await supabase.from("batches").insert({ ...newBatch, status: "OPEN" });
      if (error) throw error;
      setNewBatch({ code: "", etd: "", eta: "" });
      await loadAll();
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function addToBatch(parcelId, batchCode) {
    setBusy(true);
    try {
      const seal = prompt("Nomor segel BAG (opsional):", "");
      const bagId = prompt("ID BAG/karung (opsional):", "BAG-001");
      const upd = {
        status: seal ? "BAGGED" : "READY_TO_SHIP",
        batch_code: batchCode,
        bag_id: bagId || null,
        seal_number: seal || null,
      };
      const { error } = await supabase.from("parcels").update(upd).eq("id", parcelId);
      if (error) throw error;
      await loadAll();
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function setBatchStatus(code, status) {
    setBusy(true);
    try {
      const { error } = await supabase.from("batches").update({ status }).eq("code", code);
      if (error) throw error;
      await loadAll();
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }

  const parcelsEnriched = useMemo(() => {
    const custMap = Object.fromEntries(customers.map((c) => [c.id, c]));
    return parcels.map((p) => ({
      ...p,
      customer_name: custMap[p.customer_id]?.name,
      customer_code: custMap[p.customer_id]?.code,
    }));
  }, [parcels, customers]);

  function waMessageOnArrive(parcel) {
    return `Halo ${parcel.customer_name || "Pelanggan"}, paket ${parcel.resi} sudah **tiba** di Surabaya. Estimasi biaya ${currency(
      parcel.fee,
      lang
    )}. Status: ${parcel.status === "PAID" ? "LUNAS" : "MENUNGGU"}. Cut-off: ${CUT_OFF_DAY}.`;
  }

  function downloadManifestCSV(batchCode) {
    const rows = parcels.filter((p) => p.batch_code === batchCode);
    const headers = [
      "resi",
      "customer_code",
      "customer_name",
      "marketplace",
      "weight",
      "billable_weight",
      "rack",
      "bag_id",
      "seal_number",
      "fee",
    ];
    const lines = [headers.join(",")];
    rows.forEach((r) => {
      lines.push(
        [
          r.resi,
          r.customer_code || "",
          r.customer_name || "",
          r.marketplace || "",
          r.weight || "",
          r.billable_weight || "",
          r.rack || "",
          r.bag_id || "",
          r.seal_number || "",
          r.fee || "",
        ].join(",")
      );
    });
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${batchCode}-manifest.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      {/* Header */}
      <div className="header">
        <div className="header-inner">
          <div className="brand">
            <div className="brand-badge"></div>
            <h1>{t("app")}</h1>
            <span className="badge">PWA</span>
          </div>
          <div className="flex right">
            <div className="tabs">
              {["customers", "prealert", "receive", "billing", "batches"].map((k) => (
                <button key={k} className={`tab ${tab === k ? "active" : ""}`} onClick={() => setTab(k)}>
                  {t(k)}
                </button>
              ))}
            </div>
            <div className="lang">
              <Globe size={16} />
              <button className={lang === "id" ? "active" : ""} onClick={() => swap("id")}>
                ID
              </button>
              <button className={lang === "en" ? "active" : ""} onClick={() => swap("en")}>
                EN
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container">
        {tab === "customers" && (
          <Section id="customers" title={t("customers")} right={<span className="meta">{t("uniq")}</span>}>
            {/* Form create (responsif 1 kolom di HP) */}
            <div className="grid grid-3" style={{ opacity: busy ? 0.8 : 1 }}>
              <input
                className="input"
                placeholder={t("name")}
                value={newCust.name}
                onChange={(e) => setNewCust({ ...newCust, name: e.target.value })}
              />
              <input
                className="input"
                placeholder={t("wa")}
                value={newCust.wa}
                onChange={(e) => setNewCust({ ...newCust, wa: e.target.value })}
              />
              <input
                className="input"
                placeholder={t("address")}
                value={newCust.address}
                onChange={(e) => setNewCust({ ...newCust, address: e.target.value })}
              />
              <input
                className="input"
                placeholder={t("uniq")}
                value={newCust.code}
                onChange={(e) => setNewCust({ ...newCust, code: e.target.value })}
              />
              <select
                className="select"
                value={newCust.region}
                onChange={(e) => setNewCust({ ...newCust, region: e.target.value })}
              >
                <option value="">{t("region")}</option>
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {regionLabel(r)}
                  </option>
                ))}
              </select>
              <button className="btn btn-primary" onClick={addCustomer}>
                <Check size={16} /> {t("create")}
              </button>
            </div>

            {/* Filter bar */}
            <div className="chips">
              <button className={`chip ${regionFilter === "ALL" ? "active" : ""}`} onClick={() => setRegionFilter("ALL")}>
                {t("all")} ({customers.length})
              </button>
              {REGIONS.map((r) => (
                <button key={r} className={`chip ${regionFilter === r ? "active" : ""}`} onClick={() => setRegionFilter(r)}>
                  {regionLabel(r)} ({regionCounts[r] || 0})
                </button>
              ))}
              <div className="right"></div>
            </div>
            <input className="input" placeholder={t("search")} value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />

            {/* List as cards (lebih enak di mobile) */}
            <div className="grid grid-3 mt-6">
              {visibleCustomers.map((c) => (
                <div key={c.id} className="card">
                  <div className="flex" style={{ justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>
                        {c.name} <span className="meta">[{c.code}]</span>
                      </div>
                      <div className="meta">{c.wa || "-"} • {c.address || "-"}</div>
                    </div>
                    <span className="pill">{regionLabel(c.region)}</span>
                  </div>
                  <div className="flex" style={{ marginTop: 10 }}>
                    <select className="select" defaultValue={c.region || ""} onChange={(e) => setRegion(c.id, e.target.value)}>
                      <option value="">{t("region")}…</option>
                      {REGIONS.map((r) => (
                        <option key={r} value={r}>
                          {regionLabel(r)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {tab === "prealert" && (
          <Section title={t("prealert")}>
            <div className="grid grid-5">
              <select
                className="select"
                value={preAlert.customer_id}
                onChange={(e) => setPreAlert({ ...preAlert, customer_id: e.target.value })}
              >
                <option value="">{t("chooseCustomer")}</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} [{c.code}]
                  </option>
                ))}
              </select>
              <input
                className="input"
                placeholder={t("trackingNo")}
                value={preAlert.resi}
                onChange={(e) => setPreAlert({ ...preAlert, resi: e.target.value })}
              />
              <select
                className="select"
                value={preAlert.marketplace}
                onChange={(e) => setPreAlert({ ...preAlert, marketplace: e.target.value })}
              >
                <option>Shopee</option>
                <option>Tokopedia</option>
                <option>Lazada</option>
                <option>Tiktok Shop</option>
                <option>Other</option>
              </select>
              <input
                className="input"
                placeholder={t("value")}
                value={preAlert.declared_value}
                onChange={(e) => setPreAlert({ ...preAlert, declared_value: e.target.value })}
              />
              <button className="btn btn-primary" onClick={addPreAlert}>
                <PlusCircle size={16} /> {t("add")}
              </button>
            </div>

            <div className="mt">
              <table className="responsive">
                <thead>
                  <tr>
                    <th>{t("table.resi")}</th>
                    <th>{t("table.customer")}</th>
                    <th>{t("table.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {parcelsEnriched
                    .filter((p) => p.status === "EXPECTED")
                    .map((p) => (
                      <tr key={p.id}>
                        <td data-label={t("table.resi")}>{p.resi}</td>
                        <td data-label={t("table.customer")}>
                          {p.customer_name} [{p.customer_code}]
                        </td>
                        <td data-label={t("table.status")}>{p.status}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {tab === "receive" && (
          <Section id="receive" title={t("receive")}>
            <div className="grid grid-6">
              <input className="input" placeholder={t("scan")} value={rx.resi} onChange={(e) => setRx({ ...rx, resi: e.target.value })} />
              <input className="input" placeholder={t("weight")} value={rx.weight} onChange={(e) => setRx({ ...rx, weight: e.target.value })} />
              <input className="input" placeholder={t("L")} value={rx.l} onChange={(e) => setRx({ ...rx, l: e.target.value })} />
              <input className="input" placeholder={t("W")} value={rx.w} onChange={(e) => setRx({ ...rx, w: e.target.value })} />
              <input className="input" placeholder={t("H")} value={rx.h} onChange={(e) => setRx({ ...rx, h: e.target.value })} />
              <input className="input" placeholder={t("rack")} value={rx.rack} onChange={(e) => setRx({ ...rx, rack: e.target.value })} />
              <input
                className="file"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => setRx({ ...rx, photo_in: e.target.files?.[0] || null })}
                style={{ gridColumn: "span 3" }}
              />
              <button className="btn btn-primary" onClick={receiveParcel} style={{ gridColumn: "span 2" }}>
                <Check size={16} /> {t("receiveCalc")}
              </button>
            </div>

            <div className="mt">
              <table className="responsive">
                <thead>
                  <tr>
                    <th>{t("table.resi")}</th>
                    <th>{t("table.customer")}</th>
                    <th>{t("table.rack")}</th>
                    <th>{t("table.weight")}</th>
                    <th>{t("table.dims")}</th>
                    <th>{t("table.fee")}</th>
                    <th>{t("table.action")}</th>
                  </tr>
                </thead>
                <tbody>
                  {parcelsEnriched
                    .filter((p) => ["RECEIVED", "PAID", "READY_TO_SHIP", "BAGGED"].includes(p.status))
                    .map((p) => (
                      <tr key={p.id}>
                        <td data-label={t("table.resi")}>{p.resi}</td>
                        <td data-label={t("table.customer")}>
                          {p.customer_name} [{p.customer_code}]
                        </td>
                        <td data-label={t("table.rack")}>{p.rack}</td>
                        <td data-label={t("table.weight")}>{p.weight} kg</td>
                        <td data-label={t("table.dims")}>
                          {p.l}×{p.w}×{p.h}
                        </td>
                        <td data-label={t("table.fee")}>{currency(p.fee, lang)}</td>
                        <td data-label={t("table.action")} className="flex">
                          {p.status !== "PAID" && (
                            <button className="btn" onClick={() => markPaid(p.id)}>
                              {t("markPaid")}
                            </button>
                          )}
                          <button
                            className="btn"
                            onClick={() => {
                              navigator.clipboard.writeText(waMessageOnArrive(p));
                              alert("Copied.");
                            }}
                          >
                            {t("copyWA")}
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {tab === "billing" && (
          <Section title={t("billing")}>
            <table className="responsive">
              <thead>
                <tr>
                  <th>{t("table.resi")}</th>
                  <th>{t("table.customer")}</th>
                  <th>{t("table.status")}</th>
                  <th>{t("table.fee")}</th>
                  <th>{t("table.batch")}</th>
                  <th>{t("table.action")}</th>
                </tr>
              </thead>
              <tbody>
                {parcelsEnriched
                  .filter((p) => ["RECEIVED", "PAID", "READY_TO_SHIP", "BAGGED"].includes(p.status))
                  .map((p) => (
                    <tr key={p.id}>
                      <td data-label={t("table.resi")}>{p.resi}</td>
                      <td data-label={t("table.customer")}>
                        {p.customer_name} [{p.customer_code}]
                      </td>
                      <td data-label={t("table.status")}>{p.status}</td>
                      <td data-label={t("table.fee")}>{currency(p.fee, lang)}</td>
                      <td data-label={t("table.batch")}>{p.batch_code || "-"}</td>
                      <td data-label={t("table.action")} className="flex">
                        {p.status === "RECEIVED" && (
                          <button className="btn" onClick={() => markPaid(p.id)}>
                            {t("markPaid")}
                          </button>
                        )}
                        <select className="select" onChange={(e) => e.target.value && addToBatch(p.id, e.target.value)} defaultValue="">
                          <option value="" disabled>
                            {t("addToBatch")}
                          </option>
                          {batches.map((b) => (
                            <option key={b.code} value={b.code}>
                              {b.code}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </Section>
        )}

        {tab === "batches" && (
          <Section id="batches" title={t("batches")}>
            <div className="grid grid-4">
              <input className="input" placeholder={t("code")} value={newBatch.code} onChange={(e) => setNewBatch({ ...newBatch, code: e.target.value })} />
              <input className="input" type="date" placeholder={t("etd")} value={newBatch.etd} onChange={(e) => setNewBatch({ ...newBatch, etd: e.target.value })} />
              <input className="input" type="date" placeholder={t("eta")} value={newBatch.eta} onChange={(e) => setNewBatch({ ...newBatch, eta: e.target.value })} />
              <button className="btn btn-primary" onClick={createBatch}>
                <PlusCircle size={16} /> {t("makeBatch")}
              </button>
            </div>

            <div className="grid grid-2">
              {batches.map((b) => (
                <div key={b.code} className="card">
                  <div className="flex" style={{ justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{b.code}</div>
                      <div className="meta">
                        ETD: {b.etd?.slice(0, 10)} • ETA: {b.eta?.slice(0, 10)} • Status: {b.status}
                      </div>
                    </div>
                    <div className="flex">
                      <button className="btn" onClick={() => setBatchStatus(b.code, "ON_TRUCK")}>
                        {t("onTruck")}
                      </button>
                      <button className="btn" onClick={() => setBatchStatus(b.code, "ON_VESSEL")}>
                        {t("onVessel")}
                      </button>
                      <button className="btn" onClick={() => setBatchStatus(b.code, "ARRIVED")}>
                        {t("arrived")}
                      </button>
                    </div>
                  </div>
                  <div className="mt">
                    <table className="responsive">
                      <thead>
                        <tr>
                          <th>{t("table.resi")}</th>
                          <th>{t("table.customer")}</th>
                          <th>{t("table.bag")}</th>
                          <th>{t("table.seal")}</th>
                          <th>{t("table.weight")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parcelsEnriched
                          .filter((p) => p.batch_code === b.code)
                          .map((p) => (
                            <tr key={p.id}>
                              <td data-label={t("table.resi")}>{p.resi}</td>
                              <td data-label={t("table.customer")}>
                                {p.customer_name} [{p.customer_code}]
                              </td>
                              <td data-label={t("table.bag")}>{p.bag_id || "-"}</td>
                              <td data-label={t("table.seal")}>{p.seal_number || "-"}</td>
                              <td data-label={t("table.weight")}>{p.weight || "-"} kg</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                    <div className="flex" style={{ marginTop: 8 }}>
                      <button className="btn" onClick={() => downloadManifestCSV(b.code)}>
                        <Download size={16} /> Manifest CSV
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        <div className="footer">© {new Date().getFullYear()} Jastip Lite. {t("footer")}</div>
      </div>
    </div>
  );
}
