/**
 * IPFS Service for storing and retrieving data
 * Uses direct HTTP requests to IPFS API instead of client libraries
 * to avoid version compatibility issues
 */

// Default IPFS API endpoint
const DEFAULT_IPFS_ENDPOINT = 'http://127.0.0.1:5001/api/v0';

export const IPFSService = {
  // IPFS API endpoint
  endpoint: DEFAULT_IPFS_ENDPOINT,
  
  /**
   * Set the IPFS API endpoint
   * @param newEndpoint New API endpoint URL
   */
  setEndpoint: (newEndpoint: string) => {
    IPFSService.endpoint = newEndpoint;
  },
  
  /**
   * Add a string to IPFS
   * @param content String content to add
   * @returns IPFS CID
   */
  addString: async (content: string): Promise<string> => {
    try {
      const formData = new FormData();
      const blob = new Blob([content], { type: 'text/plain' });
      formData.append('file', blob);
      
      const response = await fetch(`${IPFSService.endpoint}/add`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`IPFS add failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.Hash;
    } catch (error) {
      console.error('Error adding string to IPFS:', error);
      throw error;
    }
  },
  
  /**
   * Add JSON data to IPFS
   * @param data JSON-serializable data
   * @returns IPFS CID
   */
  addJSON: async (data: any): Promise<string> => {
    const jsonString = JSON.stringify(data);
    return IPFSService.addString(jsonString);
  },
  
  /**
   * Add binary data to IPFS
   * @param data Binary data as Uint8Array
   * @returns IPFS CID
   */
  addBytes: async (data: Uint8Array): Promise<string> => {
    try {
      const formData = new FormData();
      const blob = new Blob([data]);
      formData.append('file', blob);
      
      const response = await fetch(`${IPFSService.endpoint}/add`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`IPFS add failed: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      return result.Hash;
    } catch (error) {
      console.error('Error adding bytes to IPFS:', error);
      throw error;
    }
  },
  
  /**
   * Get content from IPFS by CID
   * @param cid IPFS CID
   * @returns Content as string
   */
  getString: async (cid: string): Promise<string> => {
    try {
      const response = await fetch(`${IPFSService.endpoint}/cat?arg=${cid}`);
      
      if (!response.ok) {
        throw new Error(`IPFS cat failed: ${response.status} ${response.statusText}`);
      }
      
      return await response.text();
    } catch (error) {
      console.error(`Error getting content from IPFS (CID: ${cid}):`, error);
      throw error;
    }
  },
  
  /**
   * Get JSON data from IPFS by CID
   * @param cid IPFS CID
   * @returns Parsed JSON data
   */
  getJSON: async (cid: string): Promise<any> => {
    const content = await IPFSService.getString(cid);
    try {
      return JSON.parse(content);
    } catch (error) {
      console.error(`Error parsing JSON from IPFS (CID: ${cid}):`, error);
      throw new Error('Invalid JSON content');
    }
  },
  
  /**
   * Get binary data from IPFS by CID
   * @param cid IPFS CID
   * @returns Binary data as Uint8Array
   */
  getBytes: async (cid: string): Promise<Uint8Array> => {
    try {
      const response = await fetch(`${IPFSService.endpoint}/cat?arg=${cid}`);
      
      if (!response.ok) {
        throw new Error(`IPFS cat failed: ${response.status} ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } catch (error) {
      console.error(`Error getting binary data from IPFS (CID: ${cid}):`, error);
      throw error;
    }
  },
  
  /**
   * Check if IPFS node is available
   * @returns True if IPFS node is responding
   */
  isAvailable: async (): Promise<boolean> => {
    try {
      const response = await fetch(`${IPFSService.endpoint}/version`);
      return response.ok;
    } catch (error) {
      console.error('IPFS node not available:', error);
      return false;
    }
  }
};