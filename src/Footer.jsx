import { Link } from "react-router-dom";

export function Footer({ lang, note }) {
  return (
    <footer className="site-footer">
      <div className="footer-separator" />
      <div className="footer-content">
        <Link className="footer-link" to="/about">
          {lang === "zh" ? "关于" : "About"}
        </Link>
        <div className="footer-brand">
          <span className="footer-brand-name">{lang === "zh" ? "西安中轴线建筑声景" : "XI'AN"}</span>
          <span className="footer-brand-subtitle">{lang === "zh" ? "CENTRAL AXIS ARCHITECTURAL SOUNDSCAPE" : "CENTRAL AXIS ARCHITECTURAL SOUNDSCAPE"}</span>
        </div>
      </div>
      {note ? <div className="footer-note">{note}</div> : null}
    </footer>
  );
}
