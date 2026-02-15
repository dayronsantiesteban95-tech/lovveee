import { useEffect, useState } from "react";
import { TIMEZONES } from "@/lib/constants";
import { NotificationCenter } from "@/components/NotificationCenter";
import logoAzul from "@/assets/logo-azul.png";

function formatTime(timezone: string) {
  return new Date().toLocaleTimeString("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

export function GlobalHeader() {
  const [times, setTimes] = useState(
    TIMEZONES.map((tz) => ({ ...tz, time: formatTime(tz.timezone) }))
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setTimes(TIMEZONES.map((tz) => ({ ...tz, time: formatTime(tz.timezone) })));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 bg-card/90 backdrop-blur-sm flex items-center justify-between px-6 shrink-0 shadow-sm">
      <div className="flex items-center gap-3">
        <img src={logoAzul} alt="Anika Logistics" className="h-9 w-auto object-contain" />
      </div>
      <div className="flex items-center gap-6">
        {times.map((tz) => (
          <div key={tz.city} className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {tz.city}
            </span>
            <span className="font-mono text-sm font-semibold text-foreground tabular-nums">
              {tz.time}
            </span>
          </div>
        ))}
        <div className="h-6 w-px bg-border/50" />
        <NotificationCenter />
      </div>
    </header>
  );
}
