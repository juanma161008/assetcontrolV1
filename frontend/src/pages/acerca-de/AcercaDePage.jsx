import "../../styles/InfoPages.css";

export default function AcercaDePage() {
  return (
    <div className="info-page">
      <h1>Acerca De AssetControl</h1>
      <p className="info-intro">
        Plataforma para control de activos tecnológicos, mantenimientos y órdenes de trabajo.
      </p>

      <section className="info-card">
        <h2>Objetivo</h2>
        <p>
          Centralizar inventario, historial técnico y trazabilidad operativa para el área de soporte.
        </p>
      </section>

      <section className="info-card">
        <h2>Módulos Del Sistema</h2>
        <ul>
          <li>Activos: inventario y datos técnicos.</li>
          <li>Mantenimientos: registro, seguimiento y actualización.</li>
          <li>Cronograma: vista calendario de actividades.</li>
          <li>Órdenes: generación, firma y control documental.</li>
        </ul>
      </section>

      <section className="info-card">
        <h2>Versión</h2>
        <p>Versión actual: 1.0</p>
      </section>
    </div>
  );
}
