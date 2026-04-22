"use client";

import { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  glow?: boolean;
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}

export function GlassCard({ children, className = "", glow = false, title, subtitle, icon, actions }: GlassCardProps) {
  return (
    <div className={`glass-card ${glow ? "glass-card-glow" : ""} p-6 min-w-0 overflow-hidden ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/30 to-blue-500/30 border border-white/10 flex items-center justify-center text-white/90">
                {icon}
              </div>
            )}
            <div>
              {title && <h3 className="text-lg font-semibold text-white/95">{title}</h3>}
              {subtitle && <p className="text-xs text-white/50 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
