# DCS Catalog Accordion RCL

This is a React component that renders a catalog accordion. It is used to display a list of items from DCS.

### Clone the Repository

To clone the repository, run the following command:

```bash
git clone https://github.com/unfoldingWord/dcs-catalog-accordion.git
```

### Installation

To install the dependencies and build the project, we recommend using [pnpm](https://pnpm.io/). If you don't have pnpm installed, you can install it by running:

```bash
npm install -g pnpm
```

Once pnpm is installed, navigate to the project directory and run the following command to install the dependencies:

```bash
pnpm install
```

### Development

To run the development server, use the following command:

```bash
pnpm dev
```

This will start the development server and you can view the component in your browser at `http://localhost:3000`.

### Usage as a 3rd Party App

To use DcsCatalogAccordion as a 3rd party app, follow these steps:

1. Install the package from npm:

```bash
npm install dcs-catalog-accordion
```

2. Import the component into your project:

```javascript
import { DcsCatalogAccordion } from 'dcs-catalog-accordion';
```

3. Use the component in your code:

```javascript
<DcsCatalogAccordion
  languages={['en', 'fr']}
  owners={['unfoldingWord', 'Door43-Catalog']}
  subjects={['Aligned Bible', 'TSV Translation Notes']}
  stage="prod"
  dcsApiUrl="https://git.door43.org/api/v1"
/>
```

#### Props

The DcsCatalogAccordion component accepts the following props:

- `languages` (optional, defaults to all languages): An array of strings representing the languages to filter the catalog items.
- `owners` (optional, defaults to all owners): An array of strings representing the owners to filter the catalog items.
- `subjects` (optional, defaults to all subjects): An array of strings representing the subjects to filter the catalog items.
- `stage` (optional, defaults to "prod"): A string that can be either "prod" (all releases), "latest" (master and all releases), or "other" (all branches, not just master) to specify the stage of the catalog items.
- `dcsApiUrl` (optional, defaults to https://git.door43.org/api/v1): A string representing the URL of the DCS API.

## License

This project is licensed under the MIT License.
