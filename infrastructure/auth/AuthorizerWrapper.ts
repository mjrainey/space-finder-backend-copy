import { CfnOutput, Stack } from "aws-cdk-lib";
import { CognitoUserPoolsAuthorizer, RestApi } from "aws-cdk-lib/lib/aws-apigateway";
import { UserPool, UserPoolClient, CfnUserPoolGroup } from "aws-cdk-lib/lib/aws-cognito";
import { Bucket } from "aws-cdk-lib/lib/aws-s3";
import { IdentityPoolWrapper } from './IdentityPoolWrapper';


export class AuthorizerWrapper {
    private stack: Stack;
    private buckets: Bucket[];
    private objectPrefix: string;

    private userPool: UserPool;
    private userPoolClient: UserPoolClient;
    public authorizer: CognitoUserPoolsAuthorizer;
    private identityPoolWrapper: IdentityPoolWrapper;

    constructor(stack: Stack, buckets: Bucket[]){
        this.stack = stack;
        this.buckets = buckets;

        this.objectPrefix = "Space";
        // this.objectPrefix = stack.stackName;

        this.createUserPool();
        this.createUserPoolClient();
        this.createAuthorizer();
        this.createIdentityPoolWrapper();
        this.createAdminGroup();
    }

    private createUserPool() {
        const userPoolName = `${this.objectPrefix}UserPool`;
        this.userPool = new UserPool(this.stack, userPoolName, {
            userPoolName: userPoolName,
            selfSignUpEnabled: true,
            signInAliases: {
                username: true,
                email: true
            }
        });

        new CfnOutput(this.stack, 'UserPoolId', {
            value: this.userPool.userPoolId
        });
    }

    private createUserPoolClient() {
        const userPoolClientName = `${this.objectPrefix}UserPool-client`;
        this.userPoolClient = this.userPool.addClient(userPoolClientName, {
            userPoolClientName: userPoolClientName,
            authFlows: {
                adminUserPassword: true,
                custom: true,
                userPassword: true,
                userSrp: true
            },
            generateSecret: false
        });

        new CfnOutput(this.stack, 'UserPoolClientId', {
            value: this.userPoolClient.userPoolClientId
        });
    }

    private createAuthorizer() {
        const authorizerName = `${this.objectPrefix}UserAuthorizer`;
        this.authorizer = new CognitoUserPoolsAuthorizer(this.stack, authorizerName, {
            cognitoUserPools: [this.userPool],
            authorizerName: authorizerName,
            identitySource: 'method.request.header.Authorization'
        });
    }

    private createIdentityPoolWrapper() {
        this.identityPoolWrapper = new IdentityPoolWrapper(
            this.stack,
            this.userPool,
            this.userPoolClient,
            this.buckets
        )
    }

    private createAdminGroup(): CfnUserPoolGroup {
        const name = "admins";
        const group = new CfnUserPoolGroup(this.stack, name, {
            groupName: name,
            userPoolId: this.userPool.userPoolId,
            roleArn: this.identityPoolWrapper.adminRole.roleArn
        });

        return group;
    }
}