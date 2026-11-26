// Read-only access: no payment call and no Telegram login changes.
export async function readClubBenefit(benefit,request=fetch){
  const response=await request("/api/numi-club-benefits.php",{
    method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({benefit})
  });
  const data=await response.json();
  if(!response.ok||data.ok!==true||typeof data.allowed!=="boolean")throw Error("BENEFIT_UNAVAILABLE");
  if(data.allowed!==true)return {allowed:false};
  if(benefit==="rituals"&&(!Array.isArray(data.rituals)||data.rituals.length!==10))throw Error("BENEFIT_UNAVAILABLE");
  return data;
}
