const UnderConstruction = ({ title, description }) => {
  return (
    <div className="flex h-full flex-col items-center justify-center space-y-4 text-center text-muted-foreground">
      <div className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
        Em breve
      </div>
      <div>
        <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
        <p className="mt-2 max-w-md text-base leading-relaxed">{description}</p>
      </div>
    </div>
  );
};

export default UnderConstruction;
