**How to Run (Local Setup)**
-----------------------------------------------------------------------

**Backend (Spring Boot)**
Open the backend project in your preferred Java IDE (e.g., IntelliJ IDEA or Eclipse).
Locate the main application class containing the public static void main method.
Click Run Application to start the backend server.

**Frontend (React)**
Navigate to the frontend directory in your terminal.
Install the necessary dependencies by running: npm install
Start the development server by running: npm start


**Key Features**
-----------------------------------------------------------------------

**Interactive Terminal Controls**
Create and manage 3D objects using custom commands via the built-in web terminal.

Add vertices in the 3D space with specific coordinate and color parameters.

Connect points to create edges, customizing both color and line thickness.

Generate colored polygons (faces) defined by a set of connected points.

Delete specific points, lines, faces, or entire collections from the workspace.

**Grouping & Organization**
Group multiple points and objects into named collections.

Move or delete entire collections as a single cohesive unit.

**Timeline & Animation**
Assign movement paths to individual points.

Manage animations using a clip-based timeline system to orchestrate movement over time.

Stretch or shorten timeline clips to dynamically modify the duration and speed of a movement.

Delete specific animation clips directly from the timeline.

**Data Import & Cost Calculation (BOM)**
Easily bulk-import point coordinates from .csv files into the 3D space.

Automatically calculate the total material requirements of the 3D structure.

Define pricing parameters (e.g., Price/Meter) for specific line types in a pricing table to instantly calculate the total material cost of the project.
