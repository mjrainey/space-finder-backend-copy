// import { Construct } from "constructs";
import { CfnOutput, Stack } from "aws-cdk-lib";
import { UserPool, UserPoolClient, CfnIdentityPool, CfnIdentityPoolRoleAttachment } from "aws-cdk-lib/lib/aws-cognito";
import { Effect, FederatedPrincipal, PolicyStatement, Role } from "aws-cdk-lib/lib/aws-iam";
import { Bucket } from "aws-cdk-lib/lib/aws-s3";

export class IdentityPoolWrapper {
    private stack: Stack;
    private userPool: UserPool;
    private userPoolClient: UserPoolClient;

    private identityPool: CfnIdentityPool;
    private authenticatedRole: Role;
    private unAuthenticatedRole: Role;
    public adminRole: Role;
    private bucketPolicyStatements: PolicyStatement[];

    constructor(stack: Stack, userPool: UserPool, userPoolClient: UserPoolClient, buckets: Bucket[]) {
        this.stack = stack;
        this.userPool = userPool;
        this.userPoolClient = userPoolClient;

        this.bucketPolicyStatements = buckets.map((bucket) => {
            return this.createBucketPolicyStatement(bucket);
        });

        this.createIdentityPool();
        this.createRoles();
        this.attachRoles();
    }

    private createIdentityPool() {
        this.identityPool = new CfnIdentityPool(this.stack, "SpaceFinderIdentityPool", {
            allowUnauthenticatedIdentities: true,
            cognitoIdentityProviders: [{
                clientId: this.userPoolClient.userPoolClientId,
                providerName: this.userPool.userPoolProviderName
            }]
        });

        new CfnOutput(this.stack, "IdentityPoolId", {
            value: this.identityPool.ref
        });
    }

    private createRoles() {
        this.authenticatedRole = new Role(this.stack, "CognitoDefaultAuthenticatedRole", {
            assumedBy: new FederatedPrincipal("cognito-identity.amazonaws.com", {
                StringEquals: {
                    "cognito-identity.amazonaws.com:aud": this.identityPool.ref
                },
                "ForAnyValue:StringLike": {
                    "cognito-identity.amazonaws.com:amr": "authenticated"
                }
            }, "sts:AssumeRoleWithWebIdentity")
        });
        this.authenticatedRole.addToPolicy(this.bucketPolicyStatements[1]);

        this.unAuthenticatedRole = new Role(this.stack, "CognitoDefaultUnAuthenticatedRole", {
            assumedBy: new FederatedPrincipal("cognito-identity.amazonaws.com", {
                StringEquals: {
                    "cognito-identity.amazonaws.com:aud": this.identityPool.ref
                },
                "ForAnyValue:StringLike": {
                    "cognito-identity.amazonaws.com:amr": "unauthenticated"
                }
            }, "sts:AssumeRoleWithWebIdentity")
        });

        this.adminRole = new Role(this.stack, "CognitoAdminRole", {
            assumedBy: new FederatedPrincipal("cognito-identity.amazonaws.com", {
                StringEquals: {
                    "cognito-identity.amazonaws.com:aud": this.identityPool.ref
                },
                "ForAnyValue:StringLike": {
                    "cognito-identity.amazonaws.com:amr": "authenticated"
                }
            }, "sts:AssumeRoleWithWebIdentity")
        });

        this.adminRole.addToPolicy(this.bucketPolicyStatements[0]);
        this.adminRole.addToPolicy(this.bucketPolicyStatements[1]);
    }

    private attachRoles() {
        new CfnIdentityPoolRoleAttachment(this.stack, "RolesAttachment", {
            identityPoolId: this.identityPool.ref,
            roles: {
                "authenticated": this.authenticatedRole.roleArn,
                "unauthenticated": this.unAuthenticatedRole.roleArn
            },
            roleMappings: {
                adminsMapping: {
                    type: "Token",
                    ambiguousRoleResolution: "AuthenticatedRole",
                    identityProvider: `${this.userPool.userPoolProviderName}:${this.userPoolClient.userPoolClientId}`
                }
            }
        });
    }

    private createBucketPolicyStatement(bucket: Bucket): PolicyStatement {
        return new PolicyStatement({
            effect: Effect.ALLOW,
            actions: [
                "s3:PutObject",
                "s3:PutObjectAcl"
            ],
            resources: [bucket.bucketArn + "/*"]
        });
    }
}
