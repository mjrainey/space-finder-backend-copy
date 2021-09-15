import { CfnOutput, Stack } from "aws-cdk-lib";
import { CloudFrontWebDistribution } from "aws-cdk-lib/lib/aws-cloudfront";
import { Bucket } from "aws-cdk-lib/lib/aws-s3";
import { BucketDeployment, Source } from "aws-cdk-lib/lib/aws-s3-deployment";
import { join } from "path";

export class WebAppDeployment {
    private stack: Stack;

    constructor(stack: Stack, bucketSuffix: string){
        this.stack = stack;

        const bucket = this.createDeploymentBucket(bucketSuffix);
        this.createDistribution(bucket);
    }

    private createDeploymentBucket(suffix: string) {
        const bucketName = `space-app-web${suffix}`;
        const deploymentBucket = new Bucket(this.stack, "space-app-web-id", {
            bucketName: bucketName,
            publicReadAccess: true,
            websiteIndexDocument: "index.html"
        });

        new BucketDeployment( this.stack, "space-app-web-id-deployment", {
            destinationBucket: deploymentBucket,
            sources: [
                Source.asset(join(__dirname, "..", "..", "space-finder-frontend", "build"))
            ]
        });

        new CfnOutput(this.stack, "spaceFinderWebAppS3Url", {
            value: deploymentBucket.bucketWebsiteUrl
        });

        return deploymentBucket;
    }

    private createDistribution(bucket: Bucket) {
        const cloudFront = new CloudFrontWebDistribution(this.stack, "space-app-web-distribution", {
            originConfigs:[
                {
                    behaviors: [
                        { isDefaultBehavior: true }
                    ],
                    s3OriginSource: {
                        s3BucketSource: bucket
                    }
                }
            ]
        });

        new CfnOutput(this.stack, "spaceFinderWebAppCloudFrontUrl", {
            value: cloudFront.distributionDomainName
        });
    }
}
