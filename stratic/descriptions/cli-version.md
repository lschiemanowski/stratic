# version: Identify the executable

Version identifies the product and format implemented by the selected executable. This separates executable identity from project identity, particularly when different generations of Stratic coexist.

The response is a JSON object containing product, version, and formatVersion. It reports the product as Stratic, reads its release version from the package metadata, and identifies project format 1. These describe the executable even when no project is selected.

Version returns before repository resolution and rejects unexpected arguments. It does not establish that a project uses the format correctly, has valid links, or contains a prepared proposal. Those are separate properties checked by other operations.
