import numpy as np
import trimesh
import os

def generate_sphere_glb(output_path, radius=10, subdivisions=4):
    # Create a sphere mesh
    # Using subdivisions to get a smooth sphere
    sphere = trimesh.creation.uv_sphere(radius=radius, count=[64, 64])
    
    # Export as GLB
    sphere.export(output_path)
    print(f"Sphere GLB generated at: {output_path}")

if __name__ == "__main__":
    output_dir = "public"
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    output_file = os.path.join(output_dir, "360_sphere.glb")
    generate_sphere_glb(output_file)
