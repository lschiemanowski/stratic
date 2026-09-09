# version: Identify the executable

Version identifies the product and format implemented by the selected executable. This separates executable identity from project identity, particularly when different generations of Stratic coexist.

The response is a JSON object containing product, version, and formatVersion. These values are constants supplied by the executable; the current implementation reports Stratic v3, version 0.1.0, and project format 1.

The command follows common repository resolution even though its payload does not depend on project contents. It does not establish that the selected project uses that format correctly, has valid links, or contains a prepared proposal. Those are separate properties checked by other operations.
