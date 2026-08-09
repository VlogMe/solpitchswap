import "./detail-layout-fix.css";
import "./project-action-buttons.css";
import OperatingApp from "./OperatingApp";
import SiteFooter from "./SiteFooter";
import CopyCaToast from "./CopyCaToast";

export default function App() {
  return (
    <>
      <OperatingApp />
      <CopyCaToast />
      <SiteFooter />
    </>
  );
}
