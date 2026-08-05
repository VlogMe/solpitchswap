import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import NativeSwapCard from "./NativeSwapCard";

export default function NativeSwapPortal(){
  const [target,setTarget]=useState<Element|null>(null);
  useEffect(()=>{
    const find=()=>{const node=document.querySelector(".embedded-swap");if(node){node.classList.add("native-swap-mounted");setTarget(node);return true;}return false;};
    if(find())return;
    const observer=new MutationObserver(()=>{if(find())observer.disconnect();});
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[]);
  return target?createPortal(<NativeSwapCard/>,target):null;
}
