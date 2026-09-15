/* ===== Traer listas largas por paginas (PostgREST corta a 1000) ===== */
function restPag(p,tam){
 tam=tam||1000;
 var todo=[], sep=(p.indexOf('?')>=0)?'&':'?';
 function paso(off){
  return rest(p+sep+'limit='+tam+'&offset='+off).then(function(a){
   a=a||[];
   todo=todo.concat(a);
   if(a.length<tam||todo.length>=50000)return todo;
   return paso(off+tam);
  });
 }
 return paso(0);
}
