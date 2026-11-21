package com.netflix.zuul.sample.filters.inbound;

import com.netflix.zuul.context.SessionContext;
import com.netflix.zuul.filters.endpoint.ProxyEndpoint;
import com.netflix.zuul.filters.http.HttpInboundSyncFilter;
import com.netflix.zuul.message.http.HttpRequestMessage;
import com.netflix.zuul.sample.filters.endpoint.Healthcheck;

/**
 * Our routing rules (replaces the sample's Routes filter).
 *
 *   /healthcheck       -> Zuul's own health endpoint
 *   /api/users/**      -> origin "account"  (Account Service, port 5001)
 *   /api/catalog/**    -> origin "playback" (Playback & Catalogue Service, port 5002)
 *   /api/playback/**   -> origin "playback"
 *   /videos/**         -> origin "playback"
 *
 * The path is forwarded unchanged (no prefix stripping), so the Express routes
 * must be written with the same /api/... paths.
 * Host and port of each origin are set in application.properties.
 */
public class Routes extends HttpInboundSyncFilter {

    @Override
    public int filterOrder() {
        return 0;
    }

    @Override
    public boolean shouldFilter(HttpRequestMessage httpRequestMessage) {
        return true;
    }

    @Override
    public HttpRequestMessage apply(HttpRequestMessage request) {
        SessionContext context = request.getContext();
        String path = request.getPath();

        if (path.equalsIgnoreCase("/healthcheck")) {
            context.setEndpoint(Healthcheck.class.getCanonicalName());
        } else if (path.startsWith("/api/users")) {
            context.setEndpoint(ProxyEndpoint.class.getCanonicalName());
            context.setRouteVIP("account");
        } else if (path.startsWith("/api/catalog")
                || path.startsWith("/api/playback")
                || path.startsWith("/videos")) {
            context.setEndpoint(ProxyEndpoint.class.getCanonicalName());
            context.setRouteVIP("playback");
        } else {
            // Unknown path: let the Account Service answer (it returns its normal 404)
            context.setEndpoint(ProxyEndpoint.class.getCanonicalName());
            context.setRouteVIP("account");
        }

        return request;
    }
}
