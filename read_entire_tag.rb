require_relative './highlander/lib/highlander'

require_relative './ruby-nfc-1.3/lib/ruby-nfc'
#require 'ruby-nfc'
@reader = readers = NFC::Reader.all[0] 
require 'timeout'

# begin
# Timeout::timeout(5) {
  @reader.poll(Mifare::Classic::Tag, Mifare::Ultralight::Tag) do |tag|

    begin
      case tag
        when Mifare::Classic::Tag
          if tag.auth(4, :key_a, "FFFFFFFFFFFF")
           @tag = tag.uid_hex + '---' + tag.read.unpack('H*').pop
           puts @tag
         end
         if !@tag.nil?
           if @tag.length > 4
             break
           end
         end
        when Mifare::Ultralight::Tag
          tag_id = tag.read(0).unpack('H*').pop + tag.read(1).unpack('H*').pop + tag.read(2).unpack('H*').pop
          @tag = '';
           # tag_id.to_s.gsub(/0000$/, '') +  '---' + tag.read(4).unpack('H*').pop
          (0..15).each do |x|
            @tag += tag.read(x).unpack('H*').pop 
          end
          # p 'reading tag: ' + @tag.to_s
          puts @tag
          unless @tag.nil?
            if @tag.length > 4
              break
            end
          end
       end
    rescue Exception => e
       @tag = e
       p 'got exception reading ' + e.inspect
    end
  end
#   }
# rescue Timeout::Error
#   exit
# end