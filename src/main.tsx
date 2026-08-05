import React from "react";
import ReactDOM from "react-dom/client";
import OperatingApp from "./OperatingApp";
import NativeSwapPortal from "./NativeSwapPortal";
import "./sprint14.css";
import "./analyzer.css";
import "./launch-ready.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <OperatingApp />
    <NativeSwapPortal />
  </React.StrictMode>,
);
