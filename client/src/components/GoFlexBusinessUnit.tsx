import {
  GO_FLEX_BUSINESS_UNIT,
  GO_FLEX_PROJECTS,
  type GoFlexProject,
} from "../data/goFlexProjects";

function ProjectBrief({ project }: { project: GoFlexProject }) {
  return (
    <article className="goflex-project">
      <div className="goflex-project__header">
        <div>
          <h3>{project.name}</h3>
          <span className="goflex-project__period">{project.period}</span>
        </div>
        <span className="goflex-project__tag">HiveSight automation</span>
      </div>

      <p className="goflex-project__summary">{project.summary}</p>

      <div className="goflex-metrics">
        {project.metrics.map((metric) => (
          <div key={metric.label} className="goflex-metric">
            <span className="goflex-metric__label">{metric.label}</span>
            <span className="goflex-metric__value">{metric.value}</span>
            {metric.detail && (
              <span className="goflex-metric__detail">{metric.detail}</span>
            )}
          </div>
        ))}
      </div>

      <ul className="goflex-highlights">
        {project.highlights.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}

export function GoFlexBusinessUnit() {
  return (
    <section className="goflex-panel">
      <div className="goflex-panel__header">
        <div>
          <h2>{GO_FLEX_BUSINESS_UNIT.name}</h2>
          <p className="goflex-panel__description">
            {GO_FLEX_BUSINESS_UNIT.description}
          </p>
        </div>
        <span className="goflex-panel__label">ROI &amp; impact summary</span>
      </div>

      {GO_FLEX_PROJECTS.map((project) => (
        <ProjectBrief key={project.id} project={project} />
      ))}
    </section>
  );
}
