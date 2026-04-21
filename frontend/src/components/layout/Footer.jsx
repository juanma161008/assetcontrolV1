import "../../styles/Global.css";

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="app-footer">
      {/* desarrollado por JUAN MANUEL CARDENAS MONTOYA */}
      <div className="footer-container">
        <div className="footer-left">
          <span>© {currentYear} MicroCinco</span>
        </div>
        <div className="footer-center">
          <span>Gestión De Activos Tecnológicos</span>
        </div>
        <div className="footer-right footer-socials">
          <a
            className="footer-social-link"
            href="https://www.linkedin.com"
            target="_blank"
            rel="noreferrer"
          >
            LinkedIn
          </a>
          <a
            className="footer-social-link"
            href="https://www.facebook.com"
            target="_blank"
            rel="noreferrer"
          >
            Facebook
          </a>
          <a
            className="footer-social-link"
            href="https://www.instagram.com"
            target="_blank"
            rel="noreferrer"
          >
            Instagram
          </a>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
