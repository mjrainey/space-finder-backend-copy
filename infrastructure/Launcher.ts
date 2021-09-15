import { App } from "aws-cdk-lib";
import { GenericTableProps } from "./GenericTable";
import { SpaceStack } from "./SpaceStack";

const tables: GenericTableProps[] = [
    {
        tableName: "SpacesTable",
        resourceName: "spaces",
        primaryKey: "spaceId",
        secondaryIndices: ["location"]
    },
    {
        tableName: "ReservationsTable",
        resourceName: "reservations",
        primaryKey: "reservationId",
        secondaryIndices: ["user"]
    }
];

const app = new App();
new SpaceStack(app, "Space-finder", {
    stackName: "SpaceFinder"
}, tables);
