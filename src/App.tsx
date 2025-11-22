import { useState, useCallback, useEffect, useRef } from "react";
import type { Connection, EdgeChange, NodeChange } from "@xyflow/system";
import {
  ReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Edge,
  type Node,
  Background,
  Panel,
  Controls,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useQuery, useMutation } from "@tanstack/react-query";
import axios from "axios";

const CANDIDATE_ID = "f7bdf16a-092f-4eff-9a44-e784f1de02b7";
const BASE_URL =
  "https://graph-canvas-server-255258756697.europe-west1.run.app";
const DEBOUNCE_MS = 1000;

interface GraphData {
  nodes: Node[];
  edges: Edge[];
}

async function fetchGraphFile(): Promise<GraphData | null> {
  try {
    const res = await axios.get<GraphData>(`${BASE_URL}/file`, {
      headers: { "x-candidate-id": CANDIDATE_ID },
    });
    return res.data;
  } catch (err: any) {
    // If file doesn't exist, server returns 404
    if (err?.response?.status === 404) return null;
    throw new Error("Failed to fetch graph");
  }
}

async function saveGraphFile(data: GraphData): Promise<void> {
  try {
    await axios.post(`${BASE_URL}/file`, data, {
      headers: {
        "Content-Type": "application/json",
        "x-candidate-id": CANDIDATE_ID,
      },
    });
  } catch (err) {
    throw new Error("Failed to save graph");
  }
}

export default function App() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDataRef = useRef<GraphData>({ nodes, edges });

  // Keep latest data in ref
  useEffect(() => {
    latestDataRef.current = { nodes, edges };
  }, [nodes, edges]);

  let onNodesChange = useCallback(
    (changes: NodeChange<Node>[]) =>
      setNodes((nodesSnapshot) => applyNodeChanges(changes, nodesSnapshot)),
    []
  );
  let onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) =>
      setEdges((edgesSnapshot) => applyEdgeChanges(changes, edgesSnapshot)),
    []
  );
  let onConnect = useCallback(
    (params: Connection) =>
      setEdges((edgesSnapshot) => addEdge(params, edgesSnapshot)),
    []
  );

  let addNode = useCallback(
    (label: string) => {
      setNodes((nodes) => [
        ...nodes,
        {
          id: `n_${crypto.randomUUID()}`,
          position: {
            x: Math.random() * 400 + 50,
            y: Math.random() * 400 + 50,
          },
          data: { label },
          type: "default",
          selected: false,
        },
      ]);
    },
    [setNodes]
  );

  //  1. Fetch existing graph on load 
  let { data, error, isSuccess } = useQuery({
    queryKey: ["graph_file"],
    queryFn: fetchGraphFile,
    retry: false,
    refetchOnWindowFocus: false,
  });

  //  2. Sync remote graph data into local state 
  useEffect(() => {
    if (isSuccess) {
      if (data) {
        setNodes(data.nodes || []);
        setEdges(data.edges || []);
      }
      setIsLoaded(true);
    }
  }, [isSuccess, data]);

  //  3. Mutation for saving 
  const saveMutation = useMutation({
    mutationFn: saveGraphFile,
    onMutate: () => setIsSaving(true),
    onSettled: () => setIsSaving(false),
  });

  //  4. Debounced Auto-Save on changes 
  useEffect(() => {
    if (!isLoaded) return;

    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      saveMutation.mutate(latestDataRef.current);
    }, DEBOUNCE_MS);

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [nodes, edges, isLoaded]);

  if (error) {
    console.log(`[ERROR] app.fetch_graph_file.err err=${error.message}`);
  }

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodesDraggable={true}
        nodesConnectable={true}
        elementsSelectable={true}
        selectNodesOnDrag={false}
        fitView
      >
        <Background />
        <Controls />
        <AddNodePanel addNode={addNode} isSaving={isSaving} />
      </ReactFlow>
    </div>
  );
}

type AddNodePanelProps = {
  addNode: (label: string) => void;
  isSaving: boolean;
};

function AddNodePanel({ addNode, isSaving }: AddNodePanelProps) {
  let onSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const label = formData.get("label") as string;
      if (label?.trim()) {
        addNode(label.trim());
        event.currentTarget.reset();
      }
    },
    [addNode]
  );

  return (
    <Panel position="top-right">
      <form
        onSubmit={onSubmit}
        className="bg-white p-4 rounded-lg shadow-lg min-w-[200px]"
      >
        <div className="space-y-3">
          <div>
            <label
              htmlFor="label"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Label
            </label>
            <div>
              <input
                id="label"
                name="label"
                type="text"
                placeholder="Node Label"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition-colors"
          >
            Add Node
          </button>

          {/* Save Status Indicator */}
          <div className="flex items-center gap-2 text-sm pt-2 border-t border-gray-200">
            <div
              className={`w-2 h-2 rounded-full ${
                isSaving ? "bg-yellow-500 animate-pulse" : "bg-green-500"
              }`}
            />
            <span className="text-gray-600">
              {isSaving ? "Saving..." : "Saved"}
            </span>
          </div>
        </div>
      </form>
    </Panel>
  );
}
