import { Stack } from "aws-cdk-lib";
import { AuthorizationType, CognitoUserPoolsAuthorizer, Cors, LambdaIntegration, Resource, RestApi } from "aws-cdk-lib/lib/aws-apigateway";
import { AttributeType, Table } from "aws-cdk-lib/lib/aws-dynamodb";
import { NodejsFunction } from "aws-cdk-lib/lib/aws-lambda-nodejs";

import { join } from "path";
import { existsSync } from "fs";

export interface GenericTableProps {
    tableName: string;
    resourceName: string;
    primaryKey: string;
    secondaryIndices?: string[];
};

interface TableMethodProps {
    httpMethod: string;
    name: string;
}

export class GenericTable {
    private stack: Stack;
    private api: RestApi;
    private authorizer: CognitoUserPoolsAuthorizer;
    private props: GenericTableProps;

    private table: Table;
    private resource: Resource;

    public constructor(stack: Stack, api: RestApi, authorizer: CognitoUserPoolsAuthorizer, props: GenericTableProps) {
        this.stack = stack;
        this.api = api;
        this.authorizer = authorizer;
        this.props = props

        this.createTable();
        this.createSecondaryIndices();
        this.createTableResource();
        this.createTableLambdas();
    }

    private createTable() {
        this.table = new Table(this.stack, this.props.tableName, {
            partitionKey: {
                name: this.props.primaryKey,
                type: AttributeType.STRING
            },
            tableName: this.props.tableName
        });
    }

    private createSecondaryIndices() {
        if (this.props.secondaryIndices) {
            for (const index of this.props.secondaryIndices) {
                this.table.addGlobalSecondaryIndex({
                    indexName: index,
                    partitionKey: {
                        name: index,
                        type: AttributeType.STRING
                    }
                });
            }
        }
    }

    private createTableResource() {
        this.resource = this.api.root.addResource(this.props.resourceName, {
            defaultCorsPreflightOptions : {
                allowOrigins: Cors.ALL_ORIGINS,
                allowMethods: Cors.ALL_METHODS
            }
        });
    }

    private createTableLambdas() {
        const methodProps: TableMethodProps[] = [
            { httpMethod: "POST", name: "Create" },
            { httpMethod: "GET", name: "Read" },
            { httpMethod: "PUT", name: "Update" },
            { httpMethod: "DELETE", name: "Delete" }
        ];

        methodProps.forEach(({ httpMethod, name }) => {
            const path = join(__dirname, "..", "services", this.props.tableName, `${name}.ts`);
            if (existsSync(path)) {
                const lambda = this.createLambda(name, path);

                if (["POST", "PUT", "DELETE"].includes(httpMethod)) {
                    this.table.grantWriteData(lambda);
                } else if (["GET"].includes(httpMethod)) {
                    this.table.grantReadData(lambda);
                }
    
                this.resource.addMethod(httpMethod, new LambdaIntegration(lambda), {
                    authorizationType: AuthorizationType.COGNITO,
                    authorizer: {
                        authorizerId: this.authorizer.authorizerId
                    }
                });
            }
        });
    }

    private createLambda(name: string, path: string): NodejsFunction {
        const id = `${this.props.tableName}-${name}`;
        return new NodejsFunction(this.stack, id, {
            entry: path,
            handler: "handler",
            functionName: id,
            environment: {
                TABLE_NAME: this.props.tableName,
                PRIMARY_KEY: this.props.primaryKey
            }
        });
    }
}
