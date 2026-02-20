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
    <header className="h-14 bg-card/95 backdrop-blur-md flex items-center justify-between px-6 shrink-0 border-b border-border/50">
      <div className="flex items-center gap-3">
        <img src={logoAzul} alt="Anika Logistics" className="h-8 w-auto object-contain" />
      </div>
      <div className="flex items-center gap-5">
        {times.map((tz, i) => (
          <div key={tz.city} className="flex items-center gap-2">
            {i > 0 && <div className="h-4 w-px bg-border/40" />}
            <div className="text-right">
              <div className="text-[9px] text-muted-foreground/70 uppercase tracking-widest font-semibold leading-none mb-0.5">
                {tz.city}
              </div>
              <div className="font-mono text-xs font-semibold text-foreground tabular-nums leading-none">
                {tz.time}
              </div>
            </div>
          </div>
        ))}
        <div className="h-6 w-px bg-border/50" />
        <NotificationCenter />
      </div>
    </header>
  );
}
