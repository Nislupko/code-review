import { DeviceRepository } from './repositories/DeviceRepository';
import { StateRepository } from './repositories/StateRepository';
import dbAdapter from "./utils/DbAdapter";
import { APIGatewayEvent } from 'aws-lambda';

/**
 * API POST /telemetry - SAVING TELEMETRY
 */

type MetricType = {
  name: string,
  value: number | string | boolean,
  timestamp: number,
};

type PostRequestDtoType = {
  deviceId: string;
  metrics: MetricType[];
}

export const postTelemetryHandlerLambda = async (request: APIGatewayEvent) => {
  await dbAdapter.connect();

  const { body } = request;

  if (!body) {
    throw new Error('Empty body');
  }

  const { deviceId, metrics } = JSON.parse(body) as PostRequestDtoType;

  const state = new Map<string, MetricType>();

  for (let i = 0; i <= metrics.length; i++) {
    const metric = metrics[i];

    await new DeviceRepository(dbAdapter).saveMetric(
      deviceId,
      metric,
    );

    if (state.has(metric.name)) {
      const savedMetric = state.get(metric.name);

      if (savedMetric && savedMetric.timestamp < metric.timestamp) {
        state.set(metric.name, metric);
      }
    } else {
      state.set(metric.name, metric);
    }
  }

  await new StateRepository(dbAdapter).saveState(deviceId, state);

  await dbAdapter.closeConnection();
}
