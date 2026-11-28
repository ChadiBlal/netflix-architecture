package com.netflix.zuul.sample.filters.inbound;

import com.google.common.base.Strings;
import com.google.common.collect.Lists;
import com.netflix.appinfo.InstanceInfo;
import com.netflix.loadbalancer.ConfigurationBasedServerList;
import com.netflix.loadbalancer.Server;
import com.netflix.niws.loadbalancer.DiscoveryEnabledServer;
import java.util.List;
import java.util.UUID;

/**
 * Static origin list for Zuul: wraps each host:port from application.properties
 * in a DiscoveryEnabledServer, which Zuul's server resolver requires.
 */
public class OriginServerList extends ConfigurationBasedServerList {
    @Override
    protected List<Server> derive(String value) {
        List<Server> list = Lists.newArrayList();
        if (!Strings.isNullOrEmpty(value)) {
            for (String s : value.split(",", -1)) {
                String[] hostAndPort = s.split(":", -1);
                list.add(make(hostAndPort[0], Integer.parseInt(hostAndPort[1])));
            }
        }
        return list;
    }

    private static DiscoveryEnabledServer make(String host, int port) {
        InstanceInfo instanceInfo = new InstanceInfo(
                UUID.randomUUID().toString(),
                "",
                "",
                host,
                "sid123",
                new InstanceInfo.PortWrapper(true, port),
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                1,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null);
        return new DiscoveryEnabledServer(instanceInfo, false, true);
    }
}