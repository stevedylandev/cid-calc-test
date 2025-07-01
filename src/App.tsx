import { useState, useCallback, useEffect } from "react";
import {
	Upload,
	FileText,
	Folder,
	Hash,
	Loader2,
	AlertCircle,
} from "lucide-react";
import { createHelia } from "helia";
import { unixfs } from "@helia/unixfs";

const HeliaApp = () => {
	const [files, setFiles] = useState<any>([]);
	const [results, setResults] = useState<any>([]);
	const [isProcessing, setIsProcessing] = useState(false);
	const [error, setError] = useState("");
	const [heliaInstance, setHeliaInstance] = useState<any>(null);

	// Initialize Helia instance on component mount
	useEffect(() => {
		const initHelia = async () => {
			try {
				console.log("Creating Helia instance...");
				const helia = await createHelia();
				const fs = unixfs(helia);

				setHeliaInstance({ helia, fs });
				console.log("Helia instance created successfully");
			} catch (err) {
				console.error("Failed to initialize Helia:", err);
				setError(`Failed to initialize Helia: ${err}`);
			}
		};

		initHelia();
	}, []);

	// Handle folder/file selection
	const handleFileSelection = useCallback((event: any) => {
		const selectedFiles = Array.from(event.target.files);
		setFiles(selectedFiles);
		setResults([]);
		setError("");
	}, []);

	// Process files and calculate CIDs (Kubo-compatible approach)
	const calculateCIDs = useCallback(async () => {
		if (files.length === 0) {
			setError("Please select files first");
			return;
		}

		setIsProcessing(true);
		setError("");
		setResults([]);

		try {
			// Check if Helia is initialized
			if (!heliaInstance) {
				setError(
					"Helia is still initializing. Please wait a moment and try again.",
				);
				return;
			}

			const { fs } = heliaInstance;

			// Convert File objects to the format expected by Helia
			const fileEntries = await Promise.all(
				files.map(async (file: any) => {
					console.log(file.webkitRelativePath);
					const content = new Uint8Array(await file.arrayBuffer());
					return {
						path: file.webkitRelativePath || file.name,
						content: content,
					};
				}),
			);

			console.log(
				"Processing files:",
				fileEntries.map((f) => f.path),
			);

			// Kubo-compatible settings for identical CIDs
			const kuboCompatibleOptions = {
				cidVersion: 1, // Modern CID version (Kubo default with --cid-version=1)
				rawLeaves: true, // Raw leaves enabled (Kubo default for CIDv1)
				trickle: false, // Merkle DAG structure (Kubo default)
				chunkerOptions: {
					maxChunkSize: 262144, // 256KB chunks (Kubo default: size-262144)
				},
				// Directory wrapping when needed
				wrapWithDirectory:
					fileEntries.length > 1 ||
					fileEntries.some((f) => f.path.includes("/")),
			};

			const importResults = [];

			if (fileEntries.length === 1 && !fileEntries[0].path.includes("/")) {
				// Single file - use addBytes for better Kubo compatibility
				const entry = fileEntries[0];
				const cid = await fs.addBytes(entry.content, kuboCompatibleOptions);
				importResults.push({
					path: entry.path,
					cid: cid.toString(),
					size: entry.content.length,
					type: "file",
				});
				console.log("Added single file:", entry.path, "CID:", cid.toString());
			} else {
				// Multiple files or directory structure - use addAll
				for await (const entry of fs.addAll(
					fileEntries,
					kuboCompatibleOptions,
				)) {
					importResults.push({
						path: entry.path,
						cid: entry.cid.toString(),
						size: entry.size,
						type: entry.type || "file",
					});
					console.log("Added:", entry.path, "CID:", entry.cid.toString());
				}
			}

			setResults(importResults);
		} catch (err) {
			console.error("Error calculating CIDs:", err);
			setError(`Error calculating CIDs: ${err}`);
		} finally {
			setIsProcessing(false);
		}
	}, [files, heliaInstance]);

	return (
		<div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
			<div className="max-w-4xl mx-auto">
				<div className="bg-white rounded-lg shadow-xl p-6 mb-6">
					<div className="flex items-center gap-3 mb-6">
						<Hash className="w-8 h-8 text-indigo-600" />
						<h1 className="text-3xl font-bold text-gray-800">
							Helia CID Calculator
						</h1>
					</div>

					<p className="text-gray-600 mb-4">
						Upload files or folders to calculate their IPFS Content Identifiers
						(CIDs) using Helia UnixFS with Kubo-compatible settings.
					</p>

					{/* Kubo Compatibility Info */}
					<div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
						<h3 className="font-semibold text-green-800 mb-2">
							🔧 Kubo-Compatible Settings
						</h3>
						<div className="text-sm text-green-700 grid grid-cols-1 md:grid-cols-2 gap-2">
							<div>
								• <strong>CID Version:</strong> v1 (modern)
							</div>
							<div>
								• <strong>Raw Leaves:</strong> Enabled
							</div>
							<div>
								• <strong>Chunk Size:</strong> 256KB (Kubo default)
							</div>
							<div>
								• <strong>DAG Type:</strong> Merkle DAG
							</div>
							<div>
								• <strong>Hash Function:</strong> SHA-256
							</div>
							<div>
								• <strong>Chunker:</strong> Fixed size
							</div>
						</div>
						<p className="text-xs text-green-600 mt-2">
							Equivalent to:{" "}
							<code className="bg-green-100 px-1 rounded">
								ipfs add --cid-version=1 --raw-leaves --chunker=size-262144
							</code>
						</p>
					</div>

					<div className="space-y-4">
						{/* File Input */}
						<div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-indigo-400 transition-colors">
							<div className="flex flex-col items-center justify-center text-center">
								<Upload className="w-12 h-12 text-gray-400 mb-4" />
								<label htmlFor="file-input" className="cursor-pointer">
									<span className="text-lg font-medium text-gray-700 hover:text-indigo-600">
										Choose files or folders
									</span>
									<input
										id="file-input"
										type="file"
										multiple
										{...({ webkitdirectory: "" } as any)}
										className="hidden"
										onChange={handleFileSelection}
									/>
								</label>
								<p className="text-sm text-gray-500 mt-2">
									Select multiple files or an entire folder
								</p>
							</div>
						</div>

						{/* Alternative single file input */}
						<div className="text-center">
							<span className="text-gray-500">or</span>
						</div>

						<div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-indigo-400 transition-colors">
							<div className="flex flex-col items-center justify-center text-center">
								<FileText className="w-8 h-8 text-gray-400 mb-2" />
								<label htmlFor="single-file-input" className="cursor-pointer">
									<span className="text-md font-medium text-gray-700 hover:text-indigo-600">
										Choose individual files
									</span>
									<input
										id="single-file-input"
										type="file"
										multiple
										className="hidden"
										onChange={handleFileSelection}
									/>
								</label>
							</div>
						</div>

						{/* Selected Files Display */}
						{files.length > 0 && (
							<div className="bg-gray-50 rounded-lg p-4">
								<h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
									<Folder className="w-4 h-4" />
									Selected Files ({files.length})
								</h3>
								<div className="max-h-32 overflow-y-auto">
									{files.slice(0, 5).map((file: any, index: any) => (
										<div key={index} className="text-sm text-gray-600 py-1">
											{file.webkitRelativePath || file.name} (
											{(file.size / 1024).toFixed(1)} KB)
										</div>
									))}
									{files.length > 5 && (
										<div className="text-sm text-gray-500 py-1">
											... and {files.length - 5} more files
										</div>
									)}
								</div>
							</div>
						)}

						{/* Calculate Button */}
						<button
							type="button"
							onClick={calculateCIDs}
							disabled={files.length === 0 || isProcessing}
							className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
						>
							{isProcessing ? (
								<>
									<Loader2 className="w-5 h-5 animate-spin" />
									Processing...
								</>
							) : (
								<>
									<Hash className="w-5 h-5" />
									Calculate CIDs
								</>
							)}
						</button>
					</div>
				</div>

				{/* Error Display */}
				{error && (
					<div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
						<div className="flex items-center gap-2 text-red-700">
							<AlertCircle className="w-5 h-5" />
							<span className="font-semibold">Error:</span>
						</div>
						<p className="text-red-600 mt-1">{error}</p>
						<div className="mt-3 text-sm text-red-600">
							<p>
								<strong>Note:</strong> Make sure you have installed the required
								packages:
							</p>
							<code className="block mt-1 bg-red-100 p-2 rounded">
								npm install helia @helia/unixfs
							</code>
						</div>
					</div>
				)}

				{/* Results Display */}
				{results.length > 0 && (
					<div className="bg-white rounded-lg shadow-xl p-6">
						<h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
							<Hash className="w-6 h-6 text-green-600" />
							Calculated CIDs
						</h2>

						<div className="space-y-3">
							{results.map((result: any, index: any) => (
								<div
									key={index}
									className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
								>
									<div className="flex items-start gap-3">
										{result.type === "directory" ? (
											<Folder className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
										) : (
											<FileText className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" />
										)}
										<div className="flex-1 min-w-0">
											<div className="font-medium text-gray-800 break-all">
												{result.path}
											</div>
											<div className="text-sm text-gray-600 mt-1">
												Type: {result.type} | Size: {result.size} bytes
											</div>
											<div className="mt-2">
												<span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
													CID:
												</span>
												<div className="bg-gray-100 rounded p-2 mt-1 font-mono text-sm break-all">
													{result.cid}
												</div>
											</div>
										</div>
									</div>
								</div>
							))}
						</div>

						{/* Root CID Display */}
						{results.length > 1 && (
							<div className="mt-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
								<h3 className="font-semibold text-indigo-800 mb-2">
									Root Directory CID:
								</h3>
								<div className="font-mono text-sm bg-white p-3 rounded border break-all">
									{results.find(
										(r: any) => r.path === "" || r.type === "directory",
									)?.cid || results[results.length - 1]?.cid}
								</div>
								<p className="text-sm text-indigo-600 mt-2">
									This is the CID for the entire folder structure
								</p>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
};

export default HeliaApp;
