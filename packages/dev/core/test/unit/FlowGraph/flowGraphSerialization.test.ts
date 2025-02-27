import type { Engine } from "core/Engines";
import { NullEngine } from "core/Engines";
import type { FlowGraphExecutionBlock } from "core/FlowGraph";
import {
    FlowGraph,
    FlowGraphAddNumberBlock,
    FlowGraphBlock,
    FlowGraphContext,
    FlowGraphCoordinator,
    FlowGraphGetVariableBlock,
    FlowGraphLogBlock,
    FlowGraphMultiGateBlock,
    FlowGraphPlayAnimationBlock,
    FlowGraphSceneReadyEventBlock,
    RichTypeNumber,
    RichTypeVector3,
} from "core/FlowGraph";
import { FlowGraphConnectionType } from "core/FlowGraph/flowGraphConnection";
import { FlowGraphDataConnection } from "core/FlowGraph/flowGraphDataConnection";
import { Vector3 } from "core/Maths";
import { Mesh } from "core/Meshes";
import { Scene } from "core/scene";

describe("Flow Graph Serialization", () => {
    let engine: Engine;
    let scene: Scene;
    beforeEach(() => {
        console.log = jest.fn();

        engine = new NullEngine({
            renderHeight: 256,
            renderWidth: 256,
            textureSize: 256,
            deterministicLockstep: false,
            lockstepMaxSteps: 1,
        });

        scene = new Scene(engine);
    });
    it("Serializes and Parses a connection", () => {
        const block = jest.mock("core/FlowGraph/flowGraphBlock") as any;
        block.uniqueId = "test";
        const connection = new FlowGraphDataConnection("test", FlowGraphConnectionType.Input, block, RichTypeNumber);
        const serialized: any = {};
        connection.serialize(serialized);

        expect(serialized.uniqueId).toBeDefined();
        expect(serialized.name).toEqual("test");
        expect(serialized._connectionType).toEqual(FlowGraphConnectionType.Input);
        expect(serialized.connectedPointIds).toEqual([]);
        expect(serialized.className).toEqual("FGDataConnection");
        expect(serialized.richType.typeName).toEqual("number");
        expect(serialized.richType.defaultValue).toEqual(0);

        const parsed = FlowGraphDataConnection.Parse(serialized, block);
        expect(parsed.uniqueId).toEqual(connection.uniqueId);
        expect(parsed.name).toEqual("test");
        expect(parsed._connectionType).toEqual(FlowGraphConnectionType.Input);
        expect(parsed.getClassName()).toEqual("FGDataConnection");
        expect(parsed.richType.typeName).toEqual("number");
        expect(parsed.richType.defaultValue).toEqual(0);

        const connection2 = new FlowGraphDataConnection("test2", FlowGraphConnectionType.Output, block, RichTypeNumber);
        connection.connectTo(connection2);

        const serialized2: any = {};
        connection.serialize(serialized2);

        expect(serialized2.connectedPointIds[0]).toBe(connection2.uniqueId);

        const parsed2 = FlowGraphDataConnection.Parse(serialized2, block);
        expect(parsed2.connectedPointIds[0]).toBe(connection2.uniqueId);

        // Check if a more complex type is properly serialized and parsed.
        const connection3 = new FlowGraphDataConnection("test3", FlowGraphConnectionType.Output, block, RichTypeVector3);
        const serialized3: any = {};
        connection3.serialize(serialized3);
        expect(serialized3.richType.typeName).toEqual("Vector3");
        expect(serialized3.richType.defaultValue._x).toEqual(0);
        expect(serialized3.richType.defaultValue._y).toEqual(0);
        expect(serialized3.richType.defaultValue._z).toEqual(0);

        const parsed3 = FlowGraphDataConnection.Parse(serialized3, block);
        expect(parsed3.richType.typeName).toEqual("Vector3");
        expect(parsed3.richType.defaultValue.x).toEqual(0);
        expect(parsed3.richType.defaultValue.y).toEqual(0);
        expect(parsed3.richType.defaultValue.z).toEqual(0);
    });

    it("Serializes and parses a block", () => {
        const block = new FlowGraphPlayAnimationBlock();

        const serialized: any = {};
        block.serialize(serialized);
        // console.log("serialized block", serialized);
        expect(serialized.uniqueId).toBeDefined();
        expect(serialized.signalInputs.length).toEqual(1);
        expect(serialized.signalOutputs.length).toEqual(2);
        expect(serialized.dataInputs.length).toEqual(6);
        expect(serialized.dataOutputs.length).toEqual(1);
        expect(serialized.className).toEqual("FGPlayAnimationBlock");

        const parsed = FlowGraphBlock.Parse(serialized);
        expect(parsed.uniqueId).toEqual(block.uniqueId);
        expect(parsed.getClassName()).toEqual("FGPlayAnimationBlock");
        expect(parsed.dataInputs.length).toEqual(6);
        expect(parsed.dataOutputs.length).toEqual(1);
        expect((parsed as FlowGraphExecutionBlock).signalInputs.length).toEqual(1);
        expect((parsed as FlowGraphExecutionBlock).signalOutputs.length).toEqual(2);

        // Serialize a block with configuration
        const multiGateBlock = new FlowGraphMultiGateBlock({ numberOutputFlows: 3, name: "MultiGate" });
        const serialized2: any = {};
        multiGateBlock.serialize(serialized2);
        const parsed2 = FlowGraphBlock.Parse(serialized2) as any;
        expect(parsed2.outFlows.length).toEqual(3);
    });

    it("Serializes and parses a context", () => {
        const coordinator = new FlowGraphCoordinator({ scene });
        const graph = coordinator.createGraph();
        const context = graph.createContext();

        const mesh = new Mesh("testMesh", scene);

        context.setVariable("test", 42);
        context.setVariable("test2", "hello");
        context.setVariable("test3", new Vector3(1, 2, 3));
        context.setVariable("test4", mesh);

        const flowGraphAddBlock = new FlowGraphAddNumberBlock();

        flowGraphAddBlock.leftInput.setValue(1, context);
        flowGraphAddBlock.rightInput.setValue(2, context);

        const serialized: any = {};
        context.serialize(serialized);

        expect(serialized._userVariables.test).toEqual(42);
        expect(serialized._userVariables.test2).toEqual("hello");
        expect(serialized._userVariables.test3.value).toEqual([1, 2, 3]);
        expect(serialized._userVariables.test3.className).toEqual("Vector3");
        expect(serialized._userVariables.test4.name).toEqual("testMesh");
        expect(serialized._userVariables.test4.className).toEqual("Mesh");
        expect(serialized._connectionValues[flowGraphAddBlock.leftInput.uniqueId]).toEqual(1);
        expect(serialized._connectionValues[flowGraphAddBlock.rightInput.uniqueId]).toEqual(2);

        const parsed = FlowGraphContext.Parse(serialized, graph);

        expect(parsed.uniqueId).toEqual(context.uniqueId);
        expect(parsed.getClassName()).toEqual("FGContext");
        expect(parsed.getVariable("test")).toEqual(42);
        expect(parsed.getVariable("test2")).toEqual("hello");
        expect(parsed.getVariable("test3").x).toEqual(1);
        expect(parsed.getVariable("test3").y).toEqual(2);
        expect(parsed.getVariable("test3").z).toEqual(3);
        expect(parsed._getConnectionValue(flowGraphAddBlock.leftInput)).toEqual(1);
        expect(parsed._getConnectionValue(flowGraphAddBlock.rightInput)).toEqual(2);
        expect(parsed.getVariable("test4").uniqueId).toEqual(mesh.uniqueId);
    });

    it("Serializes and parses a graph", () => {
        const coordinator = new FlowGraphCoordinator({ scene });
        const graph = coordinator.createGraph();
        const context = graph.createContext();

        context.setVariable("test", 42);

        const flowGraphSceneReadyBlock = new FlowGraphSceneReadyEventBlock();
        graph.addEventBlock(flowGraphSceneReadyBlock);

        const logBlock = new FlowGraphLogBlock();
        flowGraphSceneReadyBlock.onDone.connectTo(logBlock.onStart);

        const getVariableBlock = new FlowGraphGetVariableBlock();
        getVariableBlock.variableName.setValue("test", context);

        logBlock.message.connectTo(getVariableBlock.output);

        const serialized: any = {};
        graph.serialize(serialized);

        // Graph is serialized with all blocks
        expect(serialized.allBlocks.length).toBe(3);

        const parsed = FlowGraph.Parse(serialized, coordinator);
        expect(parsed._eventBlocks.length).toBe(1);
        parsed.start();

        scene.onReadyObservable.notifyObservers(scene);
        expect(console.log).toHaveBeenCalledWith(42);
    });
});
