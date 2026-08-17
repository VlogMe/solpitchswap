import React from "react";
import ReactDOM from "react-dom/client";
import OperatingApp from "./OperatingApp";
// import NativeSwapPortal from "./NativeSwapPortal";
import JupiterSwapPortal from "./JupiterSwapPortal";
import HeaderBrandPortal from "./HeaderBrandPortal";
import PromotionOptionsPortal from "./PromotionOptionsPortal";
import NavListingPolicyPortal from "./NavListingPolicyPortal";
import "./sprint14.css";
import "./analyzer.css";
import "./launch-ready.css";
import "./nav-rail-overrides.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <OperatingApp />
    {/* Native swap temporarily set aside while testing Jupiter Plugin. */}
    {/* <NativeSwapPortal /> */}
    <JupiterSwapPortal />
    <HeaderBrandPortal />
    <PromotionOptionsPortal />
    <NavListingPolicyPortal />
  </React.StrictMode>,
);
