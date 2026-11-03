// Owner pages read study files only through the same authenticated PHP endpoint.
(()=>{'use strict';
 const nativeFetch=window.fetch.bind(window);
 window.fetch=(input,options)=>{
  const method=String(options?.method||(typeof input==='object'&&input?.method)||'GET').toUpperCase();
  if(method==='GET'&&(typeof input==='string'||input instanceof URL)){
   const url=new URL(String(input),document.baseURI);
   if(url.origin===location.origin&&/^\/pro\/(?:school\/|schools\/(?!$|index\.html$|schools\.css$))/.test(url.pathname)){
    let path=url.pathname.slice(1);if(path.endsWith('/'))path+='index.html';
    const target=new URL('/api/numi-school.php',location.origin);target.searchParams.set('file',path);
    return nativeFetch(target.href,{...options,credentials:'same-origin',cache:'no-store'});
   }
  }
  return nativeFetch(input,options);
 };
})();
