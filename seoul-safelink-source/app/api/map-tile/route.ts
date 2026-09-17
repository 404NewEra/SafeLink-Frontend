const TILE_PATTERN=/^\d+$/;

export async function GET(request:Request){
  const url=new URL(request.url);
  const z=url.searchParams.get("z");
  const x=url.searchParams.get("x");
  const y=url.searchParams.get("y");
  if(!z||!x||!y||![z,x,y].every(value=>TILE_PATTERN.test(value))){
    return new Response("Invalid map tile",{status:400});
  }
  const zoom=Number(z);
  const max=Math.pow(2,zoom);
  if(zoom<0||zoom>19||Number(x)<0||Number(x)>=max||Number(y)<0||Number(y)>=max){
    return new Response("Map tile out of range",{status:400});
  }
  const upstream=await fetch(`https://tile.openstreetmap.org/${z}/${x}/${y}.png`,{
    headers:{"User-Agent":"SeoulSafeLink/1.0 (public safety map)"},
  });
  if(!upstream.ok)return new Response("Map tile unavailable",{status:502});
  return new Response(upstream.body,{headers:{
    "Content-Type":"image/png",
    "Cache-Control":"public, max-age=86400, s-maxage=604800",
  }});
}
