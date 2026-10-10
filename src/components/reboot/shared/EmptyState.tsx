"use client";

import { cn } from "@/lib/utils";
import {
  BookOpen,
  Users,
  CalendarDays,
  Mail,
  Search,
  Inbox,
  WifiOff,
  AlertCircle,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";

export interface EmptyStateProps {
  /** Icône Lucide ou composant custom */
  icon?: LucideIcon | React.ReactNode;
  /** Nom de l'icône prédéfinie (alternative à icon) */
  preset?: "members" | "events" | "workshops" | "invitations" | "search" | "offline" | "success" | "empty";
  /** Titre principal */
  title: string;
  /** Description secondaire */
  description?: string;
  /** Action primaire (bouton) */
  action?: {
    label: string;
    onClick: () => void;
    variant?: "primary" | "secondary" | "outline";
  };
  /** Action secondaire (lien) */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  /** Taille du conteneur */
  size?: "sm" | "md" | "lg" | "full";
  /** Alignement */
  align?: "center" | "left";
  /** Classe additionnelle */
  className?: string;
  /** Illustration SVG custom (remplace icon/preset) */
  illustration?: React.ReactNode;
}

/**
 * État vide standardisé — remplace tous les états vides ad-hoc.
 * 
 * Presets disponibles :
 * - "members" : BookOpen + "Aucun membre"
 * - "events" : CalendarDays + "Aucun événement"
 * - "workshops" : BookOpen + "Aucun atelier"
 * - "invitations" : Mail + "Aucune invitation"
 * - "search" : Search + "Aucun résultat"
 * - "offline" : WifiOff + "Hors ligne"
 * - "success" : CheckCircle2 + "Terminé"
 * - "empty" : Inbox + générique
 */
export function EmptyState({
  icon,
  preset,
  title,
  description,
  action,
  secondaryAction,
  size = "md",
  align = "center",
  className,
  illustration,
}: EmptyStateProps) {
  // Résoudre l'icône depuis le preset
  let resolvedIcon: React.ReactNode | React.ComponentType<React.SVGProps<SVGSVGElement>> | undefined = icon;
  let iconColor = "text-muted-foreground/30";

  if (preset && !icon) {
    switch (preset) {
      case "members":
        resolvedIcon = Users;
        iconColor = "text-lime/30";
        break;
      case "events":
        resolvedIcon = CalendarDays;
        iconColor = "text-blue-400/30";
        break;
      case "workshops":
        resolvedIcon = BookOpen;
        iconColor = "text-purple-400/30";
        break;
      case "invitations":
        resolvedIcon = Mail;
        iconColor = "text-amber-400/30";
        break;
      case "search":
        resolvedIcon = Search;
        iconColor = "text-muted-foreground/30";
        break;
      case "offline":
        resolvedIcon = WifiOff;
        iconColor = "text-destructive/30";
        break;
      case "success":
        resolvedIcon = CheckCircle2;
        iconColor = "text-lime/30";
        break;
      case "empty":
      default:
        resolvedIcon = Inbox;
        iconColor = "text-muted-foreground/30";
    }
  }

  // Tailles responsives
  const sizeClasses = {
    sm: "py-6 px-4",
    md: "py-10 px-6",
    lg: "py-14 px-8",
    full: "flex-1 flex items-center justify-center p-8",
  };

  const iconSizes = {
    sm: "size-12",
    md: "size-16",
    lg: "size-24",
    full: "size-20",
  };

  const titleSizes = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-xl",
    full: "text-lg",
  };

  const descSizes = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
    full: "text-sm",
  };

  const gapSizes = {
    sm: "gap-2",
    md: "gap-3",
    lg: "gap-4",
    full: "gap-3",
  };

  // Capitalized variable for dynamic component rendering
  const IconComponent = typeof resolvedIcon === "function" 
    ? (resolvedIcon as React.ComponentType<React.SVGProps<SVGSVGElement>>)
    : null;

  return (
    <div
      className={cn(
        "flex flex-col",
        align === "center" ? "items-center text-center" : "items-start",
        sizeClasses[size],
        gapSizes[size],
        className
      )}
      role="status"
      aria-live="polite"
    >
      {illustration ? (
        <div className="flex-shrink-0" aria-hidden="true">
          {illustration}
        </div>
      ) : resolvedIcon ? (
        <div
          className={cn(
            "flex-shrink-0 rounded-full bg-background/50 p-3",
            iconSizes[size]
          )}
          aria-hidden="true"
        >
          {IconComponent ? (
            <IconComponent className={cn(iconColor, iconSizes[size])} />
          ) : (
            // For non-component nodes (strings, numbers, etc.)
            <span>{resolvedIcon as React.ReactNode}</span>
          )}
        </div>
      ) : null}

      <div className="space-y-1.5">
        <h3 className={cn("font-display font-semibold", titleSizes[size])}>
          {title}
        </h3>
        {description && (
          <p className={cn("text-muted-foreground max-w-md", descSizes[size])}>
            {description}
          </p>
        )}
      </div>

      {(action || secondaryAction) && (
        <div
          className={cn(
            "flex items-center gap-2 mt-1",
            align === "center" ? "justify-center" : "justify-start"
          )}
        >
          {action && (
            <button
              onClick={action.onClick}
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                action.variant === "primary"
                  ? "bg-lime text-black hover:bg-lime/90 focus-visible:ring-lime"
                  : action.variant === "outline"
                  ? "border border-border bg-background hover:bg-secondary/50 focus-visible:ring-border"
                  : "bg-secondary text-foreground hover:bg-secondary/80 focus-visible:ring-border"
              )}
            >
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Variantes spécialisées pour cas courants
 */

export function EmptyMembers({ action, ...props }: Omit<EmptyStateProps, "preset" | "title" | "description">) {
  return (
    <EmptyState
      preset="members"
      title="Aucun membre"
      description="Commencez par importer ou inviter vos premiers membres."
      action={action}
      {...props}
    />
  );
}

export function EmptyEvents({ action, ...props }: Omit<EmptyStateProps, "preset" | "title" | "description">) {
  return (
    <EmptyState
      preset="events"
      title="Aucun événement à venir"
      description="Créez votre premier événement pour rassembler la communauté."
      action={action}
      {...props}
    />
  );
}

export function EmptyWorkshops({ action, ...props }: Omit<EmptyStateProps, "preset" | "title" | "description">) {
  return (
    <EmptyState
      preset="workshops"
      title="Aucun atelier disponible"
      description="Les ateliers apparaîtront ici dès qu'ils seront publiés."
      action={action}
      {...props}
    />
  );
}

export function EmptySearch({ query, action, ...props }: { query?: string } & Omit<EmptyStateProps, "preset" | "title" | "description">) {
  return (
    <EmptyState
      preset="search"
      title={query ? `Aucun résultat pour « ${query} »` : "Aucun résultat"}
      description={query ? "Essayez avec des termes plus généraux ou vérifiez l'orthographe." : "Commencez une recherche pour voir les résultats."}
      action={action}
      {...props}
    />
  );
}

export function EmptyInvitations({ action, ...props }: Omit<EmptyStateProps, "preset" | "title" | "description">) {
  return (
    <EmptyState
      preset="invitations"
      title="Aucune invitation en attente"
      description="Les invitations envoyées apparaîtront ici."
      action={action}
      {...props}
    />
  );
}

export function OfflineState({ action, ...props }: Omit<EmptyStateProps, "preset" | "title" | "description">) {
  return (
    <EmptyState
      preset="offline"
      title="Connexion perdue"
      description="Vérifiez votre connexion internet. Les données seront synchronisées automatiquement au retour en ligne."
      action={action}
      {...props}
    />
  );
}

export function SuccessState({ title = "C'est fait !", description, action, ...props }: Omit<EmptyStateProps, "preset">) {
  return (
    <EmptyState
      preset="success"
      title={title}
      description={description}
      action={action}
      {...props}
    />
  );
}