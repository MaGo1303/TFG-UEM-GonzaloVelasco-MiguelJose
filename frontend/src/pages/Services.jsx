import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useSearchParams, Link } from 'react-router-dom';
import { useScrollReveal } from '../hooks/useAnimations';
import { motion } from 'framer-motion';
import ServiceDrawer from '../components/ServiceDrawer';

const categories = [
    { key: 'all', label: 'Todos', icon: 'fa-solid fa-star', images: ['/img/ferrari_488.png', '/img/azimut_80.jpg', '/img/bell_429.jpg'] },
    { key: 'car', label: 'Coches', icon: 'fa-solid fa-car-side', img: '/img/ferrari_488.png' },
    { key: 'yacht', label: 'Yates', icon: 'fa-solid fa-sailboat', img: '/img/azimut_80.jpg' },
    { key: 'helicopter', label: 'Helicópteros', icon: 'fa-solid fa-helicopter', img: '/img/bell_429.jpg' },
];

const cardVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.97 },
    visible: (i) => ({
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { delay: 0.05 + i * 0.05, duration: 0.4, ease: [0.23, 1, 0.32, 1] },
    }),
};

const isItemAvailable = (item) => item?.is_available === undefined || Boolean(item.is_available);
const fallbackImageByType = {
    car: '/img/ferrari_488.png',
    yacht: '/img/azimut_80.jpg',
    helicopter: '/img/bell_429.jpg',
};
const getFallbackImage = (item) => item?.image_url || fallbackImageByType[item?.type] || '';
const getPrimaryImage = (item) => item?.images?.[0] || getFallbackImage(item);
const handleImageError = (event, item) => {
    const fallback = getFallbackImage(item);
    if (fallback && event.currentTarget.dataset.fallbackApplied !== 'true') {
        event.currentTarget.dataset.fallbackApplied = 'true';
        event.currentTarget.src = fallback;
    }
};

export default function Services() {
    useScrollReveal();
    const [items, setItems] = useState([]);
    const [searchParams, setSearchParams] = useSearchParams();
    const [drawerItem, setDrawerItem] = useState(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [categoryCounts, setCategoryCounts] = useState({ all: 0, car: 0, yacht: 0, helicopter: 0 });

    const filter = searchParams.get('type') || 'all';

    const handleFilter = (cat) => {
        if (cat === 'all') {
            searchParams.delete('type');
        } else {
            searchParams.set('type', cat);
        }
        setSearchParams(searchParams);
    };

    const openDrawer = (item) => {
        setDrawerItem(item);
        setDrawerOpen(true);
    };

    const closeDrawer = () => {
        setDrawerOpen(false);
        setTimeout(() => setDrawerItem(null), 300);
    };

    useEffect(() => {
        const fetchItems = async () => {
            setLoading(true);
            const url = filter === 'all'
                ? `${import.meta.env.VITE_API_URL}/items`
                : `${import.meta.env.VITE_API_URL}/items?type=${filter}`;
            try {
                const res = await axios.get(url);
                setItems(res.data);
            } catch {
                console.error("Error fetching items");
            } finally {
                setLoading(false);
            }
        };
        fetchItems();
    }, [filter]);

    useEffect(() => {
        const fetchCounts = async () => {
            try {
                const res = await axios.get(`${import.meta.env.VITE_API_URL}/items`);
                const availableItems = res.data.filter(isItemAvailable);
                const counts = { all: availableItems.length, car: 0, yacht: 0, helicopter: 0 };
                availableItems.forEach(item => {
                    if (counts[item.type] !== undefined) counts[item.type]++;
                });
                setCategoryCounts(counts);
            } catch {
                console.error("Error fetching category counts");
            }
        };
        fetchCounts();
    }, []);

    const featured = useMemo(() => {
        if (items.length === 0) return null;
        const availableItems = items.filter(isItemAvailable);
        const featuredPool = availableItems.length > 0 ? availableItems : items;
        return featuredPool.reduce((max, item) => parseFloat(item.price) > parseFloat(max.price) ? item : max, featuredPool[0]);
    }, [items]);

    const rest = useMemo(() => {
        if (!featured) return items;
        return items.filter(item => item.id !== featured.id);
    }, [items, featured]);

    const getCategoryCount = (key) => {
        return categoryCounts[key] || 0;
    };

    return (
        <div>
            <header className="page-header services-page-header">
                <div className="wrap">
                    <div className="breadcrumb">
                        <Link to="/"><i className="fa-solid fa-house"></i> Inicio</Link>
                        <span>/</span>
                        <span>Servicios</span>
                    </div>
                    <h1>Servicios <em>Premium</em></h1>
                    <p>Selecciona una categoría y descubre nuestra selección exclusiva.</p>
                </div>
            </header>

            <div className="cat-cards-section">
                <div className="wrap">
                    <div className="cat-cards-grid">
                        {categories.map(cat => (
                            <button
                                key={cat.key}
                                className={`cat-card ${filter === cat.key && cat.key !== 'all' ? 'active' : ''}`}
                                onClick={() => handleFilter(cat.key)}
                            >
                                <div className="cat-card-img">
                                    {cat.images ? (
                                        <div className="cat-card-collage" aria-hidden="true">
                                            {cat.images.map((image) => (
                                                <img key={image} src={image} alt="" />
                                            ))}
                                        </div>
                                    ) : (
                                        <img src={cat.img} alt={cat.label} />
                                    )}
                                    <div className="cat-card-overlay"></div>
                                </div>
                                <div className="cat-card-content">
                                    <div className="cat-card-icon">
                                        <i className={cat.icon}></i>
                                    </div>
                                    <div>
                                        <h3>{cat.label}</h3>
                                        <span>{getCategoryCount(cat.key)} {cat.key === 'all' ? 'items' : 'disponibles'}</span>
                                    </div>
                                </div>
                                {filter === cat.key && cat.key !== 'all' && (
                                    <div className="cat-card-indicator" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <main className="services-main">
                <div className="wrap">
                    {loading ? (
                        <div className="services-loading">
                            <div className="services-spinner"></div>
                            <span>Cargando flota...</span>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="services-empty">
                            <i className="fa-solid fa-car-side"></i>
                            <h3>No hay servicios disponibles</h3>
                            <p>No se encontraron vehículos para esta categoría.</p>
                        </div>
                    ) : (
                        <div>
                            {featured && (
                                <button
                                    className={`showcase-card ${!isItemAvailable(featured) ? 'unavailable' : ''}`}
                                    onClick={() => openDrawer(featured)}
                                    type="button"
                                >
                                    <div className="showcase-img">
                                        {getPrimaryImage(featured)
                                            ? <img src={getPrimaryImage(featured)} alt={featured.name} onError={(event) => handleImageError(event, featured)} />
                                            : <div className="showcase-img-placeholder"><i className="fa-solid fa-image"></i></div>
                                        }
                                        <div className="showcase-overlay"></div>
                                    </div>
                                    <div className="showcase-content">
                                        <div className="showcase-badge">
                                            <i className={`fa-solid ${isItemAvailable(featured) ? 'fa-crown' : 'fa-ban'}`}></i> {isItemAvailable(featured) ? 'Más elegido' : 'No disponible'}
                                        </div>
                                        <h2 className="showcase-title">{featured.name}</h2>
                                        <p className="showcase-desc">{featured.description}</p>
                                        <div className="showcase-footer">
                                            <div className="showcase-price">
                                                <span>{featured.price}€</span>/día
                                            </div>
                                            <div className="showcase-cta">
                                                {isItemAvailable(featured) ? 'Ver detalles' : 'Ver ficha'} <i className="fa-solid fa-arrow-right"></i>
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            )}

                            {rest.length > 0 && (
                                <div className="services-grid-header">
                                    <h2>
                                        {filter === 'all' ? 'Todo el catálogo' :
                                            filter === 'car' ? 'Más coches' :
                                                filter === 'yacht' ? 'Más yates' : 'Más helicópteros'}
                                    </h2>
                                    <span className="services-count">{rest.length} vehículos</span>
                                </div>
                            )}

                            <div className="services-grid">
                                {rest.map((item, i) => (
                                    <motion.button
                                        key={item.id}
                                        className={`grid-card ${!isItemAvailable(item) ? 'unavailable' : ''}`}
                                        variants={cardVariants}
                                        initial="hidden"
                                        animate="visible"
                                        custom={i}
                                        onClick={() => openDrawer(item)}
                                        type="button"
                                    >
                                        <div className="grid-card-img">
                                            {getPrimaryImage(item)
                                                ? <img src={getPrimaryImage(item)} alt={item.name} loading="lazy" onError={(event) => handleImageError(event, item)} />
                                                : <div className="grid-card-placeholder"><i className="fa-solid fa-image"></i></div>
                                            }
                                            <div className="grid-card-overlay">
                                                <span className="grid-card-type">{item.type.toUpperCase()}</span>
                                                {!isItemAvailable(item) && <span className="grid-card-type unavailable-badge">NO DISPONIBLE</span>}
                                            </div>
                                        </div>
                                        <div className="grid-card-info">
                                            <h3>{item.name}</h3>
                                            <div className="grid-card-price">
                                                {isItemAvailable(item) ? (
                                                    <>{item.price}€<span>/día</span></>
                                                ) : (
                                                    <span className="grid-card-unavailable-text">No disponible</span>
                                                )}
                                            </div>
                                        </div>
                                    </motion.button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </main>

            <ServiceDrawer
                item={drawerItem}
                isOpen={drawerOpen}
                onClose={closeDrawer}
            />
        </div>
    );
}
