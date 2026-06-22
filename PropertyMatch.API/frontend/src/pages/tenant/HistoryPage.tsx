import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Clock, Search, MapPin } from 'lucide-react';
import { viewHistoryApi, searchHistoryApi } from '../../api';

export default function HistoryPage() {
    const navigate = useNavigate();
    const [tab, setTab] = useState<'views' | 'searches'>('views');

    const { data: viewHistory = [] } = useQuery({
        queryKey: ['view-history'],
        queryFn: () => viewHistoryApi.getAll().then(r => r.data),
        enabled: tab === 'views',
    });

    const { data: searchLogs = [] } = useQuery({
        queryKey: ['search-history'],
        queryFn: () => searchHistoryApi.getAll().then(r => r.data),
        enabled: tab === 'searches',
    });

    return (
        <div className="page-container">
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 20 }}>
                <Clock size={20} style={{ marginRight: 8, color: 'var(--accent)' }} />
                History
            </h1>

            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                {(['views', 'searches'] as const).map(t => (
                    <button
                        key={t}
                        className={`btn ${tab === t ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setTab(t)}
                    >
                        {t === 'views' ? 'Viewed Listings' : 'Search History'}
                    </button>
                ))}
            </div>

            {tab === 'views' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {viewHistory.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)' }}>No viewed listings yet.</p>
                    ) : viewHistory.map((v: any, i: number) => (
                        <div
                            key={i} className="card"
                            style={{ padding: 16, cursor: 'pointer', display: 'flex', gap: 16, alignItems: 'center' }}
                            onClick={() => navigate(`/listing/${v.listingId}`)}
                        >
                            {v.thumbnailUrl && (
                                <img src={v.thumbnailUrl} alt={v.name}
                                    style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 8 }} />
                            )}
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600 }}>{v.name}</div>
                                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                    <MapPin size={11} /> {v.address}
                                </div>
                                <div style={{ fontSize: '0.82rem', color: 'var(--accent)' }}>
                                    RM {v.price?.toLocaleString()}/mo
                                </div>
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                {new Date(v.viewedAt).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {tab === 'searches' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {searchLogs.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)' }}>No search history yet.</p>
                    ) : searchLogs.map((s: any, i: number) => {
                        let snap: any = {};
                        try { snap = JSON.parse(s.snapshot); } catch { /* ignore */ }
                        return (
                            <div key={i} className="card" style={{ padding: 16 }}>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                                    <Search size={11} /> {new Date(s.searchedAt).toLocaleString('en-MY')}
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: '0.82rem' }}>
                                    {snap.rooms && <span className="badge badge-grey">Rooms: {snap.rooms}</span>}
                                    {snap.priceMin && <span className="badge badge-grey">Min: RM{snap.priceMin.toLocaleString()}</span>}
                                    {snap.priceMax && <span className="badge badge-grey">Max: RM{snap.priceMax.toLocaleString()}</span>}
                                    {snap.residencyType && <span className="badge badge-grey">{snap.residencyType}</span>}
                                    {snap.workplaceAddress && <span className="badge badge-grey">Near: {snap.workplaceAddress}</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}