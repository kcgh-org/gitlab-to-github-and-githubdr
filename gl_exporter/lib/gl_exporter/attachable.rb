class GlExporter
  module Attachable
    ATTACHMENT_REGEX= /\[(?<link_text>[^\]\n\r]*?)\]\((?<attach_path>\/uploads\/[^)\s]+?)\)/

    def model_url_service
      @model_url_service ||= ModelUrlService.new
    end

    # Scan user content for inline attachments, serialize those attachments, and
    # update the user content to reflect the new URL.
    #
    # @param [String] type the model type we are extracting attachments from
    # @param [Hash] model the model we are extracting attachments from
    def extract_attachments(type, model)
      body_key = ["body", "note", "description"].detect { |x| model[x] }
      model[body_key] = model[body_key].to_s.gsub(ATTACHMENT_REGEX) do
        match = $~
        attach_path = match[:attach_path]
        tmp_model = {
          "type"        => type,
          "model"       => model,
          "repository"  => project,
          "attach_path" => attach_path.to_s.gsub("\\", ""),
        }
        attach_url = model_url_service.url_for_model(tmp_model, type: "attachment")
        parent_url = model_url_service.url_for_model(model, type: type)
        
        begin
          next unless archiver.save_attachment(attach_path, attach_url, parent_url)
          serialize("attachment", tmp_model)
          "[#{match[:link_text]}](#{attach_url})"
        rescue => e
          # Log error and continue with original attachment reference if extraction fails
          begin
            model_identifier = model["iid"] || model["id"] || "unknown"
            model_title = model["title"] || model["name"] || "untitled"
            project_name = project["path_with_namespace"] || project["name"] || "unknown project"
            
            error_context = "Failed to extract attachment in #{type} ##{model_identifier} ('#{model_title}') " \
                          "in project '#{project_name}'. " \
                          "Attachment path: '#{attach_path}', " \
                          "Generated URL: '#{attach_url}'. " \
                          "Error: #{e.message}. " \
                          "You might want to fix the attachment reference at the source and then run the export again."
            
            [current_export.logger, current_export.output_logger].each do |logger|
              logger.error error_context
            end
          rescue => logging_error
            # Fallback if logging fails - at least don't crash the export
            puts "ERROR: Could not extract attachment from '#{attach_path}': #{e.message}"
            puts "WARNING: Logging also failed: #{logging_error.message}"
          end
          match.to_s  # Return original match text
        end
      end
    end
  end
end
