import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { Check, PlusCircle, Lock } from 'lucide-react';

const REGIONS = ['LEMBATA','WAIWERANG','WITIHAMA','LARANTUKA'];
const label = r => ({LEMBATA:'Lembata',WAIWERANG:'Waiwerang',WITIHAMA:'Witihama',LARANTUKA:'Larantuka'}[r]||'—');

export default function PortalApp(){
  const [session,setSession]=useState(null);
  const [me,setMe]=useState(null);
  const [parcels,setParcels]=useState([]);
  const [pre,setPre]=useState({resi:'', marketplace:'Shopee', declared_value:''});

  useEffect(()=>{ (async()=>{
    const {data:{session}} = await supabase.auth.getSession();
    setSession(session);
    if(!session) return;
    // fetch or auto-create customer row
    let {data:rows} = await supabase.from('customers').select('*').eq('user_id', session.user.id).limit(1);
    if(!rows?.length){
      await supabase.from('customers').insert({
        user_id: session.user.id,
        name: session.user.user_metadata?.full_name || session.user.email,
        role: 'customer'
      });
      ({data:rows} = await supabase.from('customers').select('*').eq('user_id', session.user.id).limit(1));
    }
    setMe(rows[0] || null);
  })(); },[]);

  useEffect(()=>{ (async()=>{
    if(!me?.id) return;
    const {data} = await supabase.from('parcels').select('*')
      .eq('customer_id', me.id).order('created_at', {ascending:false});
    setParcels(data||[]);
  })(); },[me?.id]);

  async function saveProfile(lock=false){
    if(!me) return;
    if(lock && !confirm('Cek alamat & wilayah. Setelah dikunci kamu tidak bisa ubah sendiri.')) return;
    const upd = {...me};
    if(lock) upd.address_locked = true;
    const {error} = await supabase.from('customers').update(upd).eq('id', me.id);
    if(error) return alert(error.message);
    alert(lock?'Alamat dikunci.':'Profil disimpan.');
  }

  async function submitPreAlert(){
    if(!me?.id) return;
    if(!pre.resi) return alert('Isi nomor resi.');
    if(!confirm('Cek kembali data sebelum submit. Lanjutkan?')) return;
    const payload = { ...pre, customer_id: me.id, status:'EXPECTED' };
    const {error} = await supabase.from('parcels').insert(payload);
    if(error) return alert(error.message);
    setPre({resi:'', marketplace:'Shopee', declared_value:''});
    const {data} = await supabase.from('parcels').select('*')
      .eq('customer_id', me.id).order('created_at', {ascending:false});
    setParcels(data||[]);
  }

  return (
    <div className="container">
      <div className="card">
        <h2>Profil & Alamat</h2>
        {!me && <div className="meta">Memuat…</div>}
        {me && (
          <div className="grid grid-3">
            <input className="input" placeholder="Nama" value={me.name||''} onChange={e=>setMe({...me, name:e.target.value})}/>
            <input className="input" placeholder="No. WhatsApp" value={me.wa||''} onChange={e=>setMe({...me, wa:e.target.value})}/>
            <select className="select" value={me.region||''} onChange={e=>setMe({...me, region:e.target.value})} disabled={me.address_locked}>
              <option value="">Wilayah</option>
              {REGIONS.map(r=><option key={r} value={r}>{label(r)}</option>)}
            </select>
            <input className="input" placeholder="Alamat Flores" value={me.address||''} onChange={e=>setMe({...me, address:e.target.value})} disabled={me.address_locked}/>
            <div className="flex" style={{gap:8}}>
              <button className="btn btn-primary" onClick={()=>saveProfile(false)}><Check size={16}/> Simpan</button>
              <button className="btn" onClick={()=>saveProfile(true)} disabled={me.address_locked}><Lock size={16}/> Kunci Alamat</button>
            </div>
            {me.address_locked && <div className="meta">Alamat terkunci. Hubungi admin untuk mengubah.</div>}
          </div>
        )}
      </div>

      <div className="card">
        <h2>Pre-Alert (Isi Resi)</h2>
        <div className="grid grid-4">
          <input className="input" placeholder="No. Resi" value={pre.resi} onChange={e=>setPre({...pre,resi:e.target.value})}/>
          <select className="select" value={pre.marketplace} onChange={e=>setPre({...pre, marketplace:e.target.value})}>
            <option>Shopee</option><option>Tokopedia</option><option>Lazada</option><option>Tiktok Shop</option><option>Other</option>
          </select>
          <input className="input" placeholder="Nilai Barang (Rp)" value={pre.declared_value} onChange={e=>setPre({...pre, declared_value:e.target.value})}/>
          <button className="btn btn-primary" onClick={submitPreAlert}><PlusCircle size={16}/> Kirim</button>
        </div>
      </div>

      <div className="card">
        <h2>Paket Saya</h2>
        <table className="responsive">
          <thead><tr><th>Resi</th><th>Status</th><th>Batch</th><th>Biaya</th></tr></thead>
          <tbody>{parcels.map(p=>(
            <tr key={p.id}>
              <td data-label="Resi">{p.resi}</td>
              <td data-label="Status">{p.status}</td>
              <td data-label="Batch">{p.batch_code || '-'}</td>
              <td data-label="Biaya">{p.fee ? `Rp${Number(p.fee).toLocaleString('id-ID')}` : '-'}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      <div className="card">
        <h2>Estimator Ongkir (perkiraan cepat)</h2>
        <Estimator/>
      </div>
    </div>
  );
}

function Estimator(){
  const [w,setW]=useState('1'), [l,setL]=useState('20'), [wi,setWi]=useState('20'), [h,setH]=useState('20');
  const vw=(l*wi*h)/6000, bill=Math.max(Number(w||0),vw), total=5000+3000+Math.ceil(bill)*12000;
  return (
    <div className="grid grid-5">
      <input className="input" placeholder="Berat (kg)" value={w} onChange={e=>setW(e.target.value)}/>
      <input className="input" placeholder="P (cm)" value={l} onChange={e=>setL(e.target.value)}/>
      <input className="input" placeholder="L (cm)" value={wi} onChange={e=>setWi(e.target.value)}/>
      <input className="input" placeholder="T (cm)" value={h} onChange={e=>setH(e.target.value)}/>
      <div className="pill" style={{alignSelf:'center'}}>Estimasi: Rp{total.toLocaleString('id-ID')}</div>
    </div>
  );
}
