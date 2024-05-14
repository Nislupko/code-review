import { generateFixturesOfDevices } from '../../fixtures';
import axios from 'axios';
import { Lambda } from 'aws-sdk';
import AWS from 'aws-sdk';

const invokeLambda = async (payload: any): Promise<Lambda.InvocationResponse> => {
    const lambda = new Lambda();

    const params = {
        FunctionName: 'LambdaConsumer',
        Payload: JSON.stringify(payload),
    };

    return await lambda.invoke(params).promise();
};


const readDynamoDB = async (ids: string[]): Promise<any> => {
    const result = [];

    for (let i = 0; i <= ids.length; i++) {
        const params = {
            TableName: 'device-metrics',
            Key: {
                id: ids[i],
            },
        };

        const dynamodb = new AWS.DynamoDB.DocumentClient();

        const readResult = await dynamodb.get(params).promise();

        result.push(readResult.Item);
    }

    return result;
};

describe('Integration Tests for AWS Lambda Consumer and API', () => {
    const testEndpoint = 'https://some-api-for-device-dashboard.com/api';
    const deviceMetrics = generateFixturesOfDevices({
        count: 10,
        valid: true,
    });

    it('should invoke Lambda and check if the response is successful', async () => {
        const lambdaResponse = await invokeLambda(deviceMetrics);
        expect(lambdaResponse.StatusCode).toEqual(200);
    });

    it('should check if written data is accessible via API', async () => {
        const apiResponse = await axios.get(testEndpoint, {
            ids: deviceMetrics.map((device: any) => device.id),
        });

        expect(apiResponse.data.length).toEqual(10);
        expect(apiResponse.data).toContainEqual(deviceMetrics);
    });


    it('should check if data is written to the database', async () => {
        const readResponse = await readDynamoDB(deviceMetrics.map((device: any) => device.id));

        expect(readResponse.length).toEqual(10);
    });
});
