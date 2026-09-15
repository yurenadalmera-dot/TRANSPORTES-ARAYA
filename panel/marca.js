var S={},document={createElement:function(){return {getContext:function(){return {fillRect:function(){},drawImage:function(){}};},toDataURL:function(){return 'data:image/png;base64,x';}};},querySelector:function(){return null;},head:{appendChild:function(){}}};
function rest(){return Promise.resolve([]);} function Image(){}
/* ===== Icono de la aplicacion, a partir del logo de la empresa ===== */
var MRC={hecho:false};
function mrcLink(rel,href,tipo){
 var l=document.querySelector('link[rel="'+rel+'"]');
 if(!l){l=document.createElement('link');l.setAttribute('rel',rel);document.head.appendChild(l);}
 if(tipo)l.setAttribute('type',tipo);
 l.setAttribute('href',href);
 return l;
}
function mrcIcono(){
 if(MRC.hecho||!S.tk)return;
 MRC.hecho=true;
 rest('organizaciones?select=logo_b64&limit=1').then(function(a){
   var b=(a&&a[0]&&a[0].logo_b64)||'';
   if(!b)return;
   var img=new Image();
   img.onload=function(){
     try{
       var c=document.createElement('canvas');c.width=512;c.height=512;
       var x=c.getContext('2d');
       x.fillStyle='#ffffff';x.fillRect(0,0,512,512);
       var r=Math.min(448/img.width,448/img.height);
       var w=img.width*r,h=img.height*r;
       x.drawImage(img,(512-w)/2,(512-h)/2,w,h);
       var png=c.toDataURL('image/png');
       mrcLink('icon',png,'image/png');
       mrcLink('apple-touch-icon',png);
       var ruta=location.pathname+location.search;
       var man={name:'Transportes Araya Franquiz · Panel',short_name:'Araya',
         description:'Panel de gestion de Transportes Araya Franquiz',
         start_url:ruta,scope:location.pathname,display:'standalone',
         background_color:'#ffffff',theme_color:'#122470',lang:'es',
         icons:[{src:png,sizes:'512x512',type:'image/png',purpose:'any'},
                {src:png,sizes:'512x512',type:'image/png',purpose:'maskable'}]};
       mrcLink('manifest','data:application/manifest+json;charset=utf-8,'+encodeURIComponent(JSON.stringify(man)));
     }catch(_e){}
   };
   img.src=b;
 }).catch(function(){});
}
