export async function GET(request) {
    const NYPL_TOKEN = "2zqpvui7942cga29"; // Server-side secret
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('q');
    const page = searchParams.get('page') || 1;

    let url = `https://api.repo.nypl.org/api/v2/items/search?publicDomainOnly=true&per_page=12&page=${page}`;
    if (category && category !== "All") {
        url += `&q=${encodeURIComponent(category)}`;
    } else {
        url += `&q=art`;
    }

    try {
        const response = await fetch(url, {
            headers: {
                "Authorization": `Token token="${NYPL_TOKEN}"`
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
