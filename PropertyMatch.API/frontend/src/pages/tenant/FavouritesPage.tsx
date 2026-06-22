import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Heart, MapPin, BedDouble, Bath } from 'lucide-react';
import { favouritesApi } from '../../api';

export default function FavouritesPage() {
    const navigate = useNavigate();
    const qc = useQueryClient();
    const { data: favs = [], isLoading } = useQuery({
        queryKey: ['favourites'],
        queryFn: () => favouritesApi.getAll().then(r => r.data),
    });

    const removeMut = useMutation({
        mutationFn: (id: string) => favouritesApi.remove(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['favourites'] }),
    });

    if (isLoading) return <div className="page-container"><span className="spinner" /></div>;

    return (
        <div className="page-container">
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 24 }}>
                <Heart size={20} style={{ marginRight: 8, color: 'var(--accent)' }} />
                Saved Listings
            </h1>

            {favs.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '60px 0' }}>
                    <Heart size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                    <p>No saved listings yet. Heart a listing to save it here.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                    {favs.map((f: any) => (
                        <div key={f.listingId} className="card" style={{ cursor: 'pointer', position: 'relative' }}>
                            {f.thumbnailUrl && (
                                <img
                                    src={f.thumbnailUrl} alt={f.name}
                                    style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: '8px 8px 0 0' }}
                                    onClick={() => navigate(`/listing/${f.listingId}`)}
                                />
                            )}
                            <div style={{ padding: 16 }} onClick={() => navigate(`/listing/${f.listingId}`)}>
                                <div style={{ fontWeight: 600, marginBottom: 4 }}>{f.name}</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                                    <MapPin size={12} /> {f.address}
                                </div>
                                <div style={{ display: 'flex', gap: 12, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    <span><BedDouble size={12} /> {f.rooms}</span>
                                    <span><Bath size={12} /> {f.toilets}</span>
                                    <span style={{ color: 'var(--accent)', fontWeight: 600 }}>RM {f.price.toLocaleString()}/mo</span>
                                </div>
                            </div>
                            <button
                                className="btn btn-ghost btn-sm"
                                style={{ position: 'absolute', top: 8, right: 8, color: 'var(--accent)' }}
                                onClick={() => removeMut.mutate(f.listingId)}
                            >
                                <Heart size={16} fill="currentColor" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}