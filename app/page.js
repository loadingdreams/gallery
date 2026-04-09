"use client";
import { useState, useEffect, useRef, useCallback } from 'react';

// Helper for mapping categories
function getCategoryParam(museum, cat) {
    if (museum === 'aic') {
        const aicMap = {
            "Painting": "painting",
            "Photograph": "photography",
            "Sculpture": "sculpture",
            "Print": "print",
            "Textile": "textile",
            "Drawing and Watercolor": "drawing"
        };
        return aicMap[cat] || cat;
    } else if (museum === 'cma') {
        const cmaMap = {
            "Painting": "Painting",
            "Photograph": "Photography",
            "Sculpture": "Sculpture",
            "Print": "Print",
            "Textile": "Textile",
            "Drawing and Watercolor": "Drawing"
        };
        return cmaMap[cat] || cat;
    } else if (museum === 'met') {
        const metMap = {
            "Painting": "Paintings",
            "Photograph": "Photographs",
            "Sculpture": "Sculpture",
            "Print": "Prints",
            "Textile": "Textiles",
            "Drawing and Watercolor": "Drawings"
        };
        return metMap[cat] || cat;
    } else if (museum === 'loc') {
        const locMap = { "Painting": "painting", "Photograph": "photo", "Sculpture": "sculpture", "Print": "print", "Textile": "textile", "Drawing and Watercolor": "drawing" };
        return locMap[cat] || cat;
    } else if (museum === 'nypl') {
        return cat === "All" ? "art" : cat;
    }
    return cat;
}

// 1. Art Institute of Chicago
async function fetchAIC(page, category) {
    let url = `https://api.artic.edu/api/v1/artworks/search?limit=12&page=${page}&fields=id,title,artist_display,image_id,date_display,medium_display,place_of_origin,credit_line,description`;
    const catSearch = getCategoryParam('aic', category);
    if (category !== "All") url += `&q=${encodeURIComponent(catSearch)}`;
    
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    
    return data.data.filter(art => art.image_id).map(art => ({
        id: art.id,
        title: art.title || "Untitled",
        artist: art.artist_display ? art.artist_display.split('\n')[0] : "Unknown",
        date: art.date_display || "",
        medium: art.medium_display || "",
        location: "Art Institute of Chicago" + (art.place_of_origin ? ` (${art.place_of_origin})` : ""),
        shortDesc: "",
        longDesc: art.description || "",
        creditLine: art.credit_line || "",
        thumbUrl: `https://www.artic.edu/iiif/2/${art.image_id}/full/400,/0/default.jpg`,
        highResUrl: `https://www.artic.edu/iiif/2/${art.image_id}/full/843,/0/default.jpg`
    }));
}

// 2. Cleveland Museum of Art
async function fetchCMA(page, category) {
    let url = `https://openaccess-api.clevelandart.org/api/artworks?limit=12&skip=${(page-1)*12}&has_image=1`;
    const catSearch = getCategoryParam('cma', category);
    if (category !== "All") url += `&type=${encodeURIComponent(catSearch)}`;
    
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();

    return data.data.map(art => ({
        id: art.id,
        title: art.title || "Untitled",
        artist: art.creators && art.creators.length > 0 ? art.creators[0].description : "Unknown",
        date: art.creation_date || "",
        medium: art.technique || "",
        location: "Cleveland Museum of Art",
        shortDesc: art.tombstone || "",
        longDesc: art.fun_fact || art.description || "",
        creditLine: art.creditline || "",
        thumbUrl: art.images && art.images.web ? art.images.web.url : "",
        highResUrl: art.images && art.images.print ? art.images.print.url : (art.images && art.images.web ? art.images.web.url : "")
    })).filter(art => art.thumbUrl !== "");
}

// 3. The Met
async function fetchMet(page, category) {
    const searchUrl = `https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=${category !== "All" ? encodeURIComponent(getCategoryParam('met', category)) : 'art'}`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) throw new Error("HTTP " + searchRes.status);
    const searchData = await searchRes.json();
    
    if (!searchData.objectIDs) return [];
    
    const objectIDs = searchData.objectIDs.slice((page-1)*12, page*12);
    const items = await Promise.all(objectIDs.map(async id => {
        const objRes = await fetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`);
        if (!objRes.ok) return null;
        return objRes.json();
    }));

    return items.filter(art => art && art.primaryImageSmall).map(art => ({
        id: art.objectID,
        title: art.title || "Untitled",
        artist: art.artistDisplayName || "Unknown",
        date: art.objectDate || "",
        medium: art.medium || "",
        location: "The Met",
        shortDesc: "",
        longDesc: "",
        creditLine: art.creditLine || "",
        thumbUrl: art.primaryImageSmall,
        highResUrl: art.primaryImage || art.primaryImageSmall
    }));
}

// 4. NYPL (Via Internal Next.js Proxy)
async function fetchNYPL(page, category) {
    const res = await fetch(`/api/nypl?page=${page}&q=${encodeURIComponent(category)}`);
    if (!res.ok) throw new Error("NYPL server Error");
    const data = await res.json();
    let rawItems = data?.nyplAPI?.response?.result || data?.nyplAPI?.response?.capture || [];
    if (!Array.isArray(rawItems)) rawItems = [rawItems];
    
    return rawItems.map(art => {
        let thumbUrl = "";
        let highResUrl = "";
        if (art.imageLinks && art.imageLinks.imageLink) {
            const links = art.imageLinks.imageLink;
            thumbUrl = links[0] || "";
            highResUrl = links[links.length - 1] || thumbUrl;
        } else if (art.imageID) {
            thumbUrl = `https://images.nypl.org/index.php?id=${art.imageID}&t=r`;
            highResUrl = `https://images.nypl.org/index.php?id=${art.imageID}&t=w`;
        }
        return {
            id: art.uuid || String(Math.random()),
            title: art.title || "Untitled",
            artist: "NYPL Archives",
            date: art.dateString || "",
            medium: art.typeOfResource || "Archive",
            location: "New York Public Library",
            shortDesc: "", longDesc: "", creditLine: "",
            thumbUrl, highResUrl
        };
    }).filter(art => art.thumbUrl !== "");
}

// 5. LOC (Via Internal Next.js Proxy)
async function fetchLOC(page, category) {
    const res = await fetch(`/api/loc?page=${page}&q=${encodeURIComponent(category)}`);
    if (!res.ok) throw new Error("LOC server error");
    const data = await res.json();
    
    return (data.results || []).filter(art => art.image_url && art.image_url.length > 2).map(art => {
        let thumbUrl = art.image_url.length > 2 ? art.image_url[art.image_url.length - 2] : art.image_url[art.image_url.length - 1];
        let highResUrl = art.image_url[art.image_url.length - 1];
        if (thumbUrl && thumbUrl.startsWith('//')) thumbUrl = 'https:' + thumbUrl;
        if (highResUrl && highResUrl.startsWith('//')) highResUrl = 'https:' + highResUrl;

        return {
            id: art.pk || String(Math.random()),
            title: art.title || "Untitled",
            artist: art.creator ? (Array.isArray(art.creator) ? art.creator[0] : art.creator) : "Unknown",
            date: art.date || (art.created_published_date ? art.created_published_date[0] : ""),
            medium: art.medium ? (Array.isArray(art.medium) ? art.medium.join(", ") : art.medium) : "",
            location: "Library of Congress",
            shortDesc: art.description ? (Array.isArray(art.description) ? art.description[0] : art.description) : "",
            longDesc: "", creditLine: "", thumbUrl, highResUrl
        };
    });
}

// --- React Component ---
export default function GalleryPage() {
    const [museum, setMuseum] = useState('aic');
    const [category, setCategory] = useState('All');
    const [artworks, setArtworks] = useState([]);
    const [page, setPage] = useState(Math.floor(Math.random() * 80) + 1);
    const [isLoading, setIsLoading] = useState(false);
    
    const [dropdown, setDropdown] = useState(null); // 'museum' or 'category'
    const [scrollControlsVisible, setScrollControlsVisible] = useState(true);
    let lastScrollY = useRef(0);

    // Modal state
    const [modalArt, setModalArt] = useState(null);
    const [showInfo, setShowInfo] = useState(false);
    const [infoExpanded, setInfoExpanded] = useState(false);

    const loaderRef = useRef(null);

    const fetchMoreData = useCallback(async (reset = false) => {
        if (isLoading) return;
        setIsLoading(true);
        let maxPage = 80;
        if (museum === 'loc') maxPage = 8;
        if (museum === 'nypl') maxPage = 15;
        const targetPage = reset ? Math.floor(Math.random() * maxPage) + 1 : page;
        
        try {
            let newArtworks = [];
            if (museum === 'aic') newArtworks = await fetchAIC(targetPage, category);
            else if (museum === 'cma') newArtworks = await fetchCMA(targetPage, category);
            else if (museum === 'met') newArtworks = await fetchMet(targetPage, category);
            else if (museum === 'nypl') newArtworks = await fetchNYPL(targetPage, category);
            else if (museum === 'loc') newArtworks = await fetchLOC(targetPage, category);
            
            setArtworks(prev => reset ? newArtworks : [...prev, ...newArtworks]);
            setPage(targetPage + 1);
        } catch (e) {
            console.error("Fetch Error:", e);
        } finally {
            setIsLoading(false);
        }
    }, [isLoading, page, museum, category]);

    // Initial load & when state changes
    useEffect(() => {
        fetchMoreData(true);
    }, [museum, category]);

    // Infinite scroll observer
    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !isLoading) {
                fetchMoreData(false);
            }
        }, { rootMargin: '100px' });
        if (loaderRef.current) observer.observe(loaderRef.current);
        return () => observer.disconnect();
    }, [fetchMoreData, isLoading]);

    // Scroll listener for drifting controls
    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 200) {
                if (window.scrollY > lastScrollY.current) setScrollControlsVisible(false);
                else setScrollControlsVisible(true);
            } else {
                setScrollControlsVisible(true);
            }
            lastScrollY.current = window.scrollY;
        };
        window.addEventListener('scroll', handleScroll, {passive: true});
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Body scroll lock for modal
    useEffect(() => {
        if (modalArt) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = '';
        return () => { document.body.style.overflow = ''; };
    }, [modalArt]);

    return (
        <main>
            <div className={`controls ${!scrollControlsVisible ? 'hide-scroll' : ''}`}>
                <div className="dropdown">
                    <button className="control-btn" onClick={() => setDropdown(dropdown === 'category' ? null : 'category')}>
                        {category}
                    </button>
                    <div className={`dropdown-menu ${dropdown !== 'category' ? 'hidden' : ''}`}>
                        <button className={`category-option ${category === 'All' ? 'active' : ''}`} onClick={() => { setCategory('All'); setDropdown(null); }}>All</button>
                        {["Painting", "Photograph", "Sculpture", "Print", "Textile", "Drawing and Watercolor"].map(cat => (
                            <button key={cat} className={`category-option ${category === cat ? 'active' : ''}`} onClick={() => { setCategory(cat); setDropdown(null); }}>{cat}</button>
                        ))}
                    </div>
                </div>
                
                <div className="dropdown">
                    <button className="control-btn" onClick={() => setDropdown(dropdown === 'museum' ? null : 'museum')}>
                        Museums
                    </button>
                    <div className={`dropdown-menu ${dropdown !== 'museum' ? 'hidden' : ''}`}>
                        <button className={`museum-option ${museum === 'aic' ? 'active' : ''}`} onClick={() => { setMuseum('aic'); setDropdown(null); }}>Art Institute of Chicago</button>
                        <button className={`museum-option ${museum === 'cma' ? 'active' : ''}`} onClick={() => { setMuseum('cma'); setDropdown(null); }}>Cleveland Museum of Art</button>
                        <button className={`museum-option ${museum === 'met' ? 'active' : ''}`} onClick={() => { setMuseum('met'); setDropdown(null); }}>The Met (New York)</button>
                        <button className={`museum-option ${museum === 'nypl' ? 'active' : ''}`} onClick={() => { setMuseum('nypl'); setDropdown(null); }}>New York Public Library</button>
                        <button className={`museum-option ${museum === 'loc' ? 'active' : ''}`} onClick={() => { setMuseum('loc'); setDropdown(null); }}>Library of Congress</button>
                    </div>
                </div>

                <button className="control-btn" onClick={() => fetchMoreData(true)}>
                    RANDOM
                </button>
            </div>

            <div className="gallery">
                {artworks.map((art, index) => (
                    <div key={index} className="artwork-card">
                        <div className="image-container">
                            <img src={art.thumbUrl} alt={art.title} className="loaded" onClick={() => {setModalArt(art); setShowInfo(true); setInfoExpanded(false);}} />
                        </div>
                        <div className="card-info" style={{ marginTop: '8px' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 500, margin: '4px 0', textTransform: 'uppercase' }}>{art.title}</h3>
                            <p style={{ fontSize: '0.85rem', color: '#555', margin: 0, textTransform: 'uppercase' }}>{art.artist}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div ref={loaderRef} className={`loader-container ${isLoading ? 'visible' : ''}`}>
                <div className="spinner"></div>
            </div>

            {/* Brutalist Modal */}
            <div className={`modal ${!modalArt ? 'hidden' : ''}`} onClick={() => { setModalArt(null); setInfoExpanded(false); setShowInfo(false); }}>
                <div className={`modal-content ${showInfo ? 'info-active' : ''}`}>
                    {modalArt && <img src={modalArt.highResUrl} alt="High Res" onClick={(e) => { e.stopPropagation(); setShowInfo(!showInfo); }} />}
                    <div className={`modal-info ${!showInfo ? 'hidden' : ''}`} onClick={(e) => e.stopPropagation()}>
                        <div id="info-primary" className={infoExpanded ? 'hidden' : ''}>
                            <h2>{modalArt?.title}</h2>
                            <p className="info-artist">{modalArt?.artist}</p>
                            <p className="info-detail">{modalArt?.date}</p>
                            <p className="info-detail">{modalArt?.medium}</p>
                            <p className="info-detail">{modalArt?.location}</p>
                            {(modalArt?.shortDesc || modalArt?.longDesc || modalArt?.creditLine) && (
                                <button id="btn-read-more" className="control-btn" onClick={(e) => {e.stopPropagation(); setInfoExpanded(true);}}>+</button>
                            )}
                        </div>
                        <div id="info-expanded" className={!infoExpanded ? 'hidden' : ''}>
                            <h2>{modalArt?.title}</h2>
                            <p className="info-artist">{modalArt?.artist}</p>
                            <div className="long-desc">
                                {modalArt?.shortDesc && <p dangerouslySetInnerHTML={{__html: modalArt.shortDesc}}></p>}
                                {modalArt?.longDesc && <p dangerouslySetInnerHTML={{__html: modalArt.longDesc}}></p>}
                                {modalArt?.creditLine && <p><strong>Credit:</strong> {modalArt.creditLine}</p>}
                            </div>
                            <button id="btn-read-less" className="control-btn" onClick={(e) => {e.stopPropagation(); setInfoExpanded(false);}}>×</button>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
