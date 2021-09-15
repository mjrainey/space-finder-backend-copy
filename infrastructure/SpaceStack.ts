import { Construct } from "constructs";
import { CfnOutput, Fn, Stack, StackProps } from "aws-cdk-lib";
import { RestApi } from "aws-cdk-lib/lib/aws-apigateway"
import { Bucket, HttpMethods } from "aws-cdk-lib/lib/aws-s3";
import { AuthorizerWrapper } from "./auth/AuthorizerWrapper";
import { GenericTable, GenericTableProps  } from "./GenericTable";
import { WebAppDeployment } from "./WebAppDeployment";

export class SpaceStack extends Stack {
    private stackSuffix: string;

    constructor(scope: Construct, id: string, props: StackProps, tableProps: GenericTableProps[]) {
        super(scope, id, props);

        this.stackSuffix = this.createStackSuffix();

        const api = new RestApi(this, "SpaceApi");
        // const api = new RestApi(this, `${props.stackName}API`);

        const bucketNames: string[] = ["spaces-photos", "profile-photos"];
        const buckets = bucketNames.map(name => this.createBucket(name));

        const authWrapper = new AuthorizerWrapper(this, buckets);
        authWrapper.authorizer._attachToApi(api);

        tableProps.forEach(properties => {
            new GenericTable(this, api, authWrapper.authorizer, properties);
        });

        new WebAppDeployment(this, this.stackSuffix);
    }

    private createStackSuffix(): string {
        const shortStackId = Fn.select(2, Fn.split("/", this.stackId));
        const shortStackSuffix = Fn.select(4, Fn.split("-", shortStackId));
        return shortStackSuffix;
    }

    private createBucket(name: string): Bucket {
        const bucket = new Bucket(this, name, {
            bucketName: `${name}-${this.stackSuffix}`,
            cors: [{
                allowedMethods: [
                    HttpMethods.HEAD,
                    HttpMethods.GET,
                    HttpMethods.PUT
                ],
                allowedOrigins: ["*"],
                allowedHeaders: ["*"]
            }]
        });

        new CfnOutput(this, `${name}-bucket-name`, {
            value: bucket.bucketName
        });

        return bucket;
    }
}
