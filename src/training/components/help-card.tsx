interface HelpCardProps {
  icon?: string;
  title: string;
  description: string;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: "primary" | "secondary";
  }>;
  dismissible?: boolean;
  onDismiss?: () => void;
}

export function HelpCard({
  icon = "ℹ️",
  title,
  description,
  actions,
  dismissible = false,
  onDismiss,
}: HelpCardProps) {
  return (
    <div className="p-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
      <div className="flex gap-3">
        <span className="text-lg flex-shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-blue-900 dark:text-blue-100">{title}</h3>
          <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">{description}</p>

          {actions && actions.length > 0 && (
            <div className="flex gap-2 mt-3">
              {actions.map((action) => (
                <button
                  key={action.label}
                  onClick={action.onClick}
                  className={`text-xs px-3 py-1.5 rounded font-medium transition-colors ${
                    action.variant === "primary"
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-white dark:bg-blue-800 text-blue-700 dark:text-blue-100 border border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-700"
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {dismissible && (
          <button
            onClick={onDismiss}
            className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 flex-shrink-0"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
