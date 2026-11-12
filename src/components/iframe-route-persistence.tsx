"use client";

import { Suspense, useCallback, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const IFRAME_PARENT_ORIGIN = "https://app.cacidhotel.com.ng";
const ROUTE_MESSAGE_TYPE = "V9_HOTEL_ROUTE_CHANGE";

function RouteReporter() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  const reportCurrentRoute = useCallback(() => {
    if (typeof window === "undefined" || window.parent === window) {
      return;
    }

    const route =
      window.location.pathname +
      window.location.search +
      window.location.hash;

    window.parent.postMessage(
      {
        type: ROUTE_MESSAGE_TYPE,
        route,
      },
      IFRAME_PARENT_ORIGIN
    );
  }, []);

  useEffect(() => {
    // Report immediately on mount and whenever Next.js changes the route
    // or its query string. The parent validates the iframe origin and message.
    reportCurrentRoute();

    // Hash navigation does not necessarily change usePathname().
    window.addEventListener("hashchange", reportCurrentRoute);

    return () => {
      window.removeEventListener("hashchange", reportCurrentRoute);
    };
  }, [pathname, search, reportCurrentRoute]);

  return null;
}

/**
 * Reports the current Next.js URL to the trusted iframe wrapper.
 * Suspense is required because useSearchParams() may suspend during
 * production rendering on statically rendered routes.
 */
export default function IframeRoutePersistence() {
  return (
    <Suspense fallback={null}>
      <RouteReporter />
    </Suspense>
  );
}
