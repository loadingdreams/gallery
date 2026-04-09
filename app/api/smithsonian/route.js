export async function GET(request) {
    const SI_TOKEN = "4ZfnshfIu5R4V8nygIhOvsPXiLIFJ0HeldyPyz4Y"; // Provided Smithsonian Token
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('q');
    const page = searchParams.get('page') || 1;

    // Smithsonian uses "start" and "rows" instead of page numbers
    const rows = 12;
    const start = (page - 1) * rows;

    let queryStr = `online_visual_material:true`;
    if (category && category !== "All") {
        queryStr += ` AND ${encodeURIComponent(category)}`;
    }

    let url = `https://api.si.edu/openaccess/api/v1.0/search?api_key=${SI_TOKEN}&q=${queryStr}&start=${start}&rows=${rows}`;

    try {
        const response = await fetch(url);
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
