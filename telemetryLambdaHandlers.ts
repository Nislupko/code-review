import { DeviceRepository } from './repositories/DeviceRepository';
import { StateRepository } from './repositories/StateRepository';
import dbAdapter from "./utils/DbAdapter";
import { readFile } from 'fs';
import { APIGatewayEvent } from 'aws-lambda';

/**
 * API GET /read - READ FILE HANDLER
 */

type GetRequestDtoType = {
  filename: string;
}

const cache = new Map();

function consistentReadAsync (filename: string) {
  if (cache.has(filename)) {
    return cache.get(filename);
  } else {
    return new Promise((resolve) => {
      readFile(`/tmp/${filename}`, 'utf8', (err, data) => {
        resolve(data);
      });
    });
  }
}

export const getReadFileHandlerLambda = async (request: APIGatewayEvent) => {
  const { pathParameters } = request;
  const { filename } = pathParameters as GetRequestDtoType;

  return consistentReadAsync(filename);
}

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
