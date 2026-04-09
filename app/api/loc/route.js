export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('q');
    const page = searchParams.get('page') || 1;
    
    let locUrl = `https://www.loc.gov/photos/?fo=json&c=12&sp=${page}`;
    if (category && category !== "All") {
        locUrl += `&q=${encodeURIComponent(category)}`;
    }

    try {
        const response = await fetch(locUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 Gallery Proxy"
            }
        });
        const data = await response.json();
        
        return new Response(JSON.stringify(data), {
            status: 200,
            headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*" 
            }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
