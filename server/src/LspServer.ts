import { AnalyzeRequest, Client, runServer, SimpleCatalog, SimpleColumn, SimpleTable, SimpleType, TypeKind } from '@fivetrandevelopers/zetasql';
import { LanguageOptions } from '@fivetrandevelopers/zetasql/lib/LanguageOptions';
import { ErrorMessageMode } from '@fivetrandevelopers/zetasql/lib/types/zetasql/ErrorMessageMode';
import { AnalyzeResponse } from '@fivetrandevelopers/zetasql/lib/types/zetasql/local_service/AnalyzeResponse';
import { ZetaSQLBuiltinFunctionOptions } from '@fivetrandevelopers/zetasql/lib/ZetaSQLBuiltinFunctionOptions';
import { Diagnostic, DiagnosticSeverity, DidChangeConfigurationNotification, DidOpenTextDocumentParams, Hover, HoverParams, InitializeParams, InitializeResult, Position, Range, TextDocumentChangeEvent, TextDocuments, TextDocumentSyncKind, _Connection } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Documents } from './Document';

export class LspServer {
    connection: _Connection;
    documents: Documents;
    catalog = new SimpleCatalog('catalog');
    hasConfigurationCapability: boolean = false;
    ast: Map<string, AnalyzeResponse> = new Map();

    constructor(connection: _Connection, documents: TextDocuments<TextDocument>) {
        this.connection = connection;
        this.documents = new Documents(documents);
    }

    async initialize(params: InitializeParams) {
        await this.initizelizeZetasql();

        let capabilities = params.capabilities;
    
        // Does the client support the `workspace/configuration` request?
        // If not, we fall back using global settings.
        this.hasConfigurationCapability = !!(
            capabilities.workspace && !!capabilities.workspace.configuration
        );
    
        const result: InitializeResult = {
            capabilities: {
                textDocumentSync: TextDocumentSyncKind.Incremental,
                hoverProvider : true,
            }
        };
        return result;
    }

    async initizelizeZetasql() {
        runServer().catch(err => console.error(err));
        await Client.INSTANCE.testConnection();
        await this.initializeCatalog();
    }
    
    async initializeCatalog() {
        const projectCatalog = new SimpleCatalog('digital-arbor-400');
        const datasetCatalog = new SimpleCatalog('pg_public');
        projectCatalog.addSimpleCatalog(datasetCatalog);
        this.catalog.addSimpleCatalog(projectCatalog);
        datasetCatalog.addSimpleTable('transformations',
          new SimpleTable('transformations', undefined, [
            new SimpleColumn('transformations', 'id', new SimpleType(TypeKind.TYPE_STRING)),
            new SimpleColumn('transformations', 'name', new SimpleType(TypeKind.TYPE_STRING)),
            new SimpleColumn('transformations', 'group_id', new SimpleType(TypeKind.TYPE_STRING)),
            new SimpleColumn('transformations', 'paused', new SimpleType(TypeKind.TYPE_BOOL)),
            new SimpleColumn('transformations', 'trigger', new SimpleType(TypeKind.TYPE_STRING)),
            new SimpleColumn('transformations', 'created_at', new SimpleType(TypeKind.TYPE_TIMESTAMP)),
            new SimpleColumn('transformations', 'created_by_id', new SimpleType(TypeKind.TYPE_STRING)),
            new SimpleColumn(
              'transformations',
              'last_started_at',
              new SimpleType(TypeKind.TYPE_TIMESTAMP),
            ),
            new SimpleColumn('transformations', 'status', new SimpleType(TypeKind.TYPE_STRING)),
            new SimpleColumn('transformations', '_fivetran_deleted', new SimpleType(TypeKind.TYPE_BOOL)),
          ]),
        );
        const options = await new LanguageOptions().enableMaximumLanguageFeatures();
        await this.catalog.addZetaSQLFunctions(new ZetaSQLBuiltinFunctionOptions(options));
        await this.catalog.register();
    }

    didChangeContent(change: TextDocumentChangeEvent<TextDocument>) {
        this.validateDocument(change.document);
    }

    async validateDocument(document: TextDocument): Promise<void> {
        const analyzeRequest: AnalyzeRequest = {
            sqlStatement: document.getText(),
            registeredCatalogId: this.catalog.registeredId,
            options: {
                errorMessageMode: ErrorMessageMode.ERROR_MESSAGE_ONE_LINE,
            },
        };
    
        const diagnostics: Diagnostic[] = [];
        try {
            this.ast.set(document.uri, await Client.INSTANCE.analyze(analyzeRequest));
            // console.log(JSON.stringify(this.ast, null, "    ") );
        } catch (e) {
            // Parse string like 'Unrecognized name: paused1; Did you mean paused? [at 9:3]'
            if (e.code == 3) {
                let matchResults = e.details.match(/(.*?) \[at (\d+):(\d+)\]/);
                let position = Position.create(matchResults[2] - 1, matchResults[3] - 1);
                const range = this.documents.getIdentifierRangeAtPosition(document.uri, position);

                const diagnostic: Diagnostic = {
                    severity: DiagnosticSeverity.Error,
                    range: range,
                    message: matchResults[1],
                };
                diagnostics.push(diagnostic);
            }
        }
        this.connection.sendDiagnostics({ uri: document.uri, diagnostics });
    }

    initialized() {
        if (this.hasConfigurationCapability) {
            // Register for all configuration changes.
            this.connection.client.register(DidChangeConfigurationNotification.type, undefined);
        }    
    }

    hover(hoverParams: HoverParams): Hover {
        const range = this.documents.getIdentifierRangeAtPosition(hoverParams.textDocument.uri, hoverParams.position);
        const text = this.documents.getText(hoverParams.textDocument.uri, range);
        const outputColumn = this.ast.get(hoverParams.textDocument.uri)?.resolvedStatement?.resolvedQueryStmtNode?.outputColumnList?.find(c => c.name === text);
        let hint;
        if (outputColumn) {
            if (outputColumn?.column?.tableName === '$query' || outputColumn?.column?.name !== outputColumn?.name) {
                hint = `Alias: ${outputColumn?.name}`;
            } else if (outputColumn?.name) {
                hint = this.getColumnHint(outputColumn?.column?.tableName, outputColumn?.name, <TypeKind>outputColumn?.column?.type?.typeKind);
            }
        }
        if (!hint) {
            const column = this.ast.get(hoverParams.textDocument.uri)?.resolvedStatement?.resolvedQueryStmtNode?.query?.resolvedProjectScanNode?.inputScan?.resolvedFilterScanNode?.inputScan?.resolvedTableScanNode?.parent?.columnList?.find(c => c.name === text);
            if (column) {
                hint = this.getColumnHint(column?.tableName, column?.name, <TypeKind>column?.type?.typeKind);
            }
        }
		return {
			contents: {
				kind: 'plaintext',
				value: hint ?? ''
			}
		}
    }

    getColumnHint(tableName?: string, columnName?: string, columnTypeKind?: TypeKind) {
        const type = new SimpleType(<TypeKind>columnTypeKind).getTypeName(); 
        return `Table: ${tableName}\nColumn: ${columnName}\nType: ${type}`;
    }
}
