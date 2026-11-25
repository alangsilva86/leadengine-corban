export const TemplateBubble = ({ template, caption }) => {
  const name = typeof template?.name === 'string' ? template.name : null;
  const language = typeof template?.language === 'string' ? template.language : null;
  const components = Array.isArray(template?.components) ? template.components : [];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1 rounded-lg bg-surface-sunken px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Mensagem modelo
        </span>
        {name ? <span className="text-sm font-medium text-foreground">{name}</span> : null}
        {language ? <span className="text-xs text-muted-foreground">Idioma: {language}</span> : null}
        {components.length > 0 ? (
          <ul className="ml-4 list-disc text-xs text-muted-foreground">
            {components.map((component, index) => (
              <li key={`component-${index}`}>
                {component?.type ?? 'Componente'}
                {component?.text ? `: ${component.text}` : ''}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {caption ? <p className="text-xs text-muted-foreground">{caption}</p> : null}
    </div>
  );
};

export default TemplateBubble;
